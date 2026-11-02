import { writeFileSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const names = [
  ['棒锥螺', 'Turritella terebra', 'Turritella terebra bacillum'],
  ['方斑东风螺', 'Babylonia areolata', null],
  ['尖锥蟹守螺', 'Cerithium vulgatum', null],
  ['瘤荔枝螺', 'Thais tuberosa', 'Menathais tuberosa'],
  ['缢蛏', 'Sinonovacula constricta', null],
  ['泥蚶', 'Tegillarca granosa', 'Anadara granosa'],
  ['紫贻贝', 'Mytilus edulis', null],
  ['栉孔扇贝', 'Chlamys farreri', 'Azumapecten farreri'],
  ['小眼花帘蛤', 'Ruditapes variegatus', 'Venerupis variegata'],
  ['环纹货贝', 'Monetaria annulus', 'Cypraea annulus'],
];
const out = [];
for (const [cn, sci, alt] of names) {
  const rec = { cn, sci, alt };
  for (const q of [sci, alt].filter(Boolean)) {
    try {
      const u = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(q)}?like=false&marine_only=true`;
      const r = await fetch(u, { signal: AbortSignal.timeout(40000) });
      if (r.status !== 200) { rec[q] = { err: r.status }; await sleep(300); continue; }
      const arr = await r.json();
      const a = arr[0];
      rec[q] = {
        AphiaID: a.AphiaID, scientificname: a.scientificname, authority: a.authority, status: a.status,
        unacceptreason: a.unacceptreason, valid_name: a.valid_name, valid_AphiaID: a.valid_AphiaID,
        family: a.family, order: a.order, class: a.class, phylum: a.phylum, rank: a.rank, isMarine: a.isMarine,
      };
    } catch (e) { rec[q] = { err: String(e).slice(0, 60) }; }
    await sleep(350);
  }
  out.push(rec);
  const a = rec[sci] || rec[alt];
  console.log(`${cn.padEnd(6)} ${sci.padEnd(24)} status=${a?.status} 接受名=${a?.valid_name} 科=${a?.family} 目=${a?.order} 纲=${a?.class}`);
}
writeFileSync('C:\\Users\\ccai\\Desktop\\mollusca-db\\data\\worms.json', JSON.stringify(out, null, 1), 'utf8');
