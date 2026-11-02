import { readFileSync, writeFileSync } from 'node:fs';
const P = 'C:\\Users\\ccai\\Desktop\\mollusca-db\\data\\raw.json';
const raw = JSON.parse(readFileSync(P, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const j = async u => { const t = await (await fetch(u, { signal: AbortSignal.timeout(45000) })).text(); return JSON.parse(t); };

function parseLineage(xml) {
  const name = xml.match(/<ScientificName>([^<]+)<\/ScientificName>/)?.[1];
  const rank = xml.match(/<Rank>([^<]+)<\/Rank>/)?.[1];
  const div = xml.match(/<Division>([^<]+)<\/Division>/)?.[1];
  const commonName = xml.match(/<CommonName>([^<]+)<\/CommonName>/)?.[1];
  const lin = [];
  const block = xml.match(/<LineageEx>([\s\S]*?)<\/LineageEx>/)?.[1] || '';
  const re = /<Taxon>\s*<TaxId>\d+<\/TaxId>\s*<ScientificName>([^<]+)<\/ScientificName>\s*<Rank>([^<]+)<\/Rank>/g;
  let m;
  while ((m = re.exec(block))) lin.push({ name: m[1], rank: m[2] });
  return { name, rank, div, commonName, lin };
}

const fix = { 'Cerithium vulgatum': 3901986, 'Thais tuberosa': 508960 };

for (const s of raw) {
  if (!fix[s.sci]) continue;
  s.taxid = fix[s.sci];
  s.matchedName = s.sci;
  const xml = await (await fetch(`${EU}/efetch.fcgi?db=taxonomy&id=${s.taxid}&retmode=xml`)).text();
  s.tax = parseLineage(xml);
  await sleep(400);

  const rep = await j(`https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/${s.taxid}/dataset_report?page_size=5`);
  s.genomes = (rep?.reports || []).map(r => ({
    acc: r.accession, name: r.assembly_info?.assembly_name, level: r.assembly_info?.assembly_level,
    size: r.assembly_stats?.total_sequence_length, n50: r.assembly_stats?.scaffold_n50,
    gc: r.assembly_stats?.gc_percent, date: r.assembly_info?.release_date,
  }));
  await sleep(400);

  const prot = await j(`${EU}/esearch.fcgi?db=protein&retmode=json&term=${encodeURIComponent(`"${s.sci}"[Organism] AND refseq[filter]`)}`);
  s.refseqProtein = +(prot.esearchresult?.count || 0);
  await sleep(400);
  const nt = await j(`${EU}/esearch.fcgi?db=nuccore&retmode=json&term=${encodeURIComponent(`"${s.sci}"[Organism]`)}`);
  s.nucleotide = +(nt.esearchresult?.count || 0);
  s.tax.lineageText = s.tax.lin.map(x => `${x.name}(${x.rank})`).join(' > ');
  console.log(`${s.cn}: taxid=${s.taxid} 谱系=${s.tax.lin.map(x => x.name).join('/')} 基因组=${s.genomes.length} refseqProt=${s.refseqProtein} nt=${s.nucleotide}`);
  await sleep(400);
}

// Cerithium vulgatum: 该物种仅有 3 条核酸记录，看看是什么
const c = raw.find(x => x.sci === 'Cerithium vulgatum');
const nt = await j(`${EU}/esearch.fcgi?db=nuccore&retmode=json&term=${encodeURIComponent('"Cerithium vulgatum"[Organism]')}`);
const ids = nt.esearchresult.idlist || [];
if (ids.length) {
  const sum = await j(`${EU}/esummary.fcgi?db=nuccore&retmode=json&id=${ids.join(',')}`);
  console.log('\nCerithium vulgatum 现有核酸记录:');
  for (const id of ids) {
    const r = sum.result?.[id];
    console.log(`  ${r?.accessionversion} len=${r?.slen} :: ${String(r?.title).slice(0, 120)}`);
  }
  // 取其中最长的一条真实序列
  const fa = await (await fetch(`${EU}/efetch.fcgi?db=nuccore&id=${ids.join(',')}&rettype=fasta&retmode=text`)).text();
  const recs = fa.split(/^>/m).slice(1).map(ch => {
    const nl = ch.indexOf('\n');
    const head = ch.slice(0, nl).trim();
    const seq = ch.slice(nl + 1).replace(/[^A-Za-z]/g, '').toUpperCase();
    return { acc: head.split(/\s+/)[0], def: head.slice(0, 160), len: seq.length, gc: +(100 * [...seq].filter(x => x === 'G' || x === 'C').length / seq.length).toFixed(2), seq };
  });
  recs.sort((a, b) => b.len - a.len);
  c.coi = recs.slice(0, 3);
  console.log(`  已收录 ${c.coi.length} 条，最长 ${c.coi[0]?.len}bp`);
}

writeFileSync(P, JSON.stringify(raw, null, 1), 'utf8');
console.log('\nUPDATED ' + P);
