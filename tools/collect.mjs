import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'C:\\Users\\ccai\\Desktop\\mollusca-db';
mkdirSync(OUT + '\\tools', { recursive: true });
mkdirSync(OUT + '\\data', { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      const t = await r.text();
      if (r.status === 200) return t;
      if (r.status === 429) { await sleep(1500); continue; }
      return null;
    } catch (e) {
      await sleep(800 * (i + 1));
    }
  }
  return null;
}
const j = async u => { const t = await get(u); return t ? JSON.parse(t) : null; };
const EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const species = [
  { cn: '棒锥螺', sci: 'Turritella terebra', alt: ['Turritella terebra bacillum'] },
  { cn: '方斑东风螺', sci: 'Babylonia areolata', alt: [] },
  { cn: '尖锥蟹守螺', sci: 'Cerithium vulgatum', alt: [] },
  { cn: '瘤荔枝螺', sci: 'Thais tuberosa', alt: [] },
  { cn: '缢蛏', sci: 'Sinonovacula constricta', alt: ['Solen constricta'] },
  { cn: '泥蚶', sci: 'Tegillarca granosa', alt: ['Anadara granosa', 'Arca granosa'] },
  { cn: '紫贻贝', sci: 'Mytilus edulis', alt: [] },
  { cn: '栉孔扇贝', sci: 'Chlamys farreri', alt: ['Azumapecten farreri', 'Chlamys farreri nipponensis'] },
  { cn: '小眼花帘蛤', sci: 'Ruditapes variegatus', alt: ['Veremolpa micra', 'Tapes variegatus'] },
  { cn: '环纹货贝', sci: 'Monetaria annulus', alt: ['Cypraea annulus'] },
];

async function taxidOf(names) {
  for (const n of names) {
    const r = await j(`${EU}/esearch.fcgi?db=taxonomy&retmode=json&term=${encodeURIComponent('"' + n + '"[Scientific Name]')}`);
    await sleep(360);
    const ids = r?.esearchresult?.idlist || [];
    if (ids.length) return { taxid: ids[0], matched: n };
  }
  return null;
}

function parseLineage(xml) {
  const name = xml.match(/<ScientificName>([^<]+)<\/ScientificName>/)?.[1];
  const rank = xml.match(/<Rank>([^<]+)<\/Rank>/)?.[1];
  const div = xml.match(/<Division>([^<]+)<\/Division>/)?.[1];
  const lin = [];
  const block = xml.match(/<LineageEx>([\s\S]*?)<\/LineageEx>/)?.[1] || '';
  const re = /<Taxon>\s*<TaxId>\d+<\/TaxId>\s*<ScientificName>([^<]+)<\/ScientificName>\s*<Rank>([^<]+)<\/Rank>[\s\S]*?<\/Taxon>/g;
  let m;
  while ((m = re.exec(block))) lin.push({ name: m[1], rank: m[2] });
  const commonName = xml.match(/<CommonName>([^<]+)<\/CommonName>/)?.[1];
  return { name, rank, div, lin, commonName };
}

function parseFasta(text) {
  const recs = [];
  for (const chunk of text.split(/^>/m).slice(1)) {
    const nl = chunk.indexOf('\n');
    const head = chunk.slice(0, nl).trim();
    const seq = chunk.slice(nl + 1).replace(/[^A-Za-z]/g, '').toUpperCase();
    const acc = head.split(/\s+/)[0];
    recs.push({ acc, head, seq });
  }
  return recs;
}
const gcOf = s => +(100 * [...s].filter(c => c === 'G' || c === 'C').length / s.length).toFixed(2);

const out = [];
for (const sp of species) {
  const line = { ...sp, raw: {} };
  const tx = await taxidOf([sp.sci, ...sp.alt]);
  line.taxid = tx?.taxid || null;
  line.matchedName = tx?.matched || null;

  if (tx) {
    const xml = await get(`${EU}/efetch.fcgi?db=taxonomy&id=${tx.taxid}&retmode=xml`);
    await sleep(360);
    if (xml) line.tax = parseLineage(xml);
  }

  // COI barcode
  const term = `"${sp.sci}"[Organism] AND (COI[Gene] OR cox1[Gene] OR "cytochrome c oxidase subunit I"[All Fields]) AND 400:1200[SLEN]`;
  const coiSearch = await j(`${EU}/esearch.fcgi?db=nuccore&retmode=json&retmax=8&term=${encodeURIComponent(term)}`);
  await sleep(360);
  const ids = coiSearch?.esearchresult?.idlist || [];
  line.coiCount = +(coiSearch?.esearchresult?.count || 0);
  const coiRecs = [];
  if (ids.length) {
    const fa = await get(`${EU}/efetch.fcgi?db=nuccore&id=${ids.join(',')}&rettype=fasta&retmode=text`);
    await sleep(360);
    if (fa) {
      for (const r of parseFasta(fa)) {
        const org = r.head.split('|')[0] || '';
        coiRecs.push({ acc: r.acc, def: r.head.slice(0, 160), len: r.seq.length, gc: gcOf(r.seq), seq: r.seq });
      }
    }
  }
  coiRecs.sort((a, b) => Math.abs(658 - a.len) - Math.abs(658 - b.len));
  line.coi = coiRecs.slice(0, 3);

  // genome assemblies
  if (line.taxid) {
    const rep = await j(`https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/${line.taxid}/dataset_report?page_size=5`);
    await sleep(360);
    const reports = rep?.reports || [];
    line.genomes = reports.map(r => ({
      acc: r.accession,
      name: r.assembly_info?.assembly_name,
      level: r.assembly_info?.assembly_level,
      size: r.assembly_stats?.total_sequence_length,
      n50: r.assembly_stats?.scaffold_n50,
      contigN50: r.assembly_stats?.contig_n50,
      gc: r.assembly_stats?.gc_percent,
      refseq: r.assembly_info?.refseq_category,
      date: r.assembly_info?.release_date,
    }));
  }

  // record counts
  const protQ = await j(`${EU}/esearch.fcgi?db=protein&retmode=json&term=${encodeURIComponent(`"${sp.sci}"[Organism] AND refseq[filter]`)}`);
  await sleep(360);
  line.refseqProtein = +(protQ?.esearchresult?.count || 0);
  const ntQ = await j(`${EU}/esearch.fcgi?db=nuccore&retmode=json&term=${encodeURIComponent(`"${sp.sci}"[Organism]`)}`);
  await sleep(360);
  line.nucleotide = +(ntQ?.esearchresult?.count || 0);

  out.push(line);
  console.log(`${sp.cn} ${sp.sci} taxid=${line.taxid}(${line.matchedName}) COI=${line.coiCount} genomes=${line.genomes?.length || 0} refseqProt=${line.refseqProtein} nt=${line.nucleotide} 取到序列=${line.coi.length}`);
}

writeFileSync(OUT + '\\data\\raw.json', JSON.stringify(out, null, 1), 'utf8');
console.log('\nSAVED ' + OUT + '\\data\\raw.json');
