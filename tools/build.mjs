import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const D = 'C:\\Users\\ccai\\Desktop\\mollusca-db\\';
const raw = JSON.parse(readFileSync(D + 'data\\raw.json', 'utf8'));
const worms = JSON.parse(readFileSync(D + 'data\\worms.json', 'utf8'));
mkdirSync(D + 'data\\fasta', { recursive: true });

const ZH_FAMILY = {
  Turritellidae: '锥螺科', Babyloniidae: '东风螺科', Cerithiidae: '蟹守螺科', Muricidae: '骨螺科',
  Pharidae: '竹蛏科', Arcidae: '蚶科', Mytilidae: '贻贝科', Pectinidae: '扇贝科',
  Veneridae: '帘蛤科', Cypraeidae: '宝贝科',
};
const ZH_CLASS = { Gastropoda: '腹足纲', Bivalvia: '双壳纲（瓣鳃纲）' };

const CONTENT = {
  'Turritella terebra': {
    形态: '壳高、细长呈螺旋锥状，螺层可达 20 层以上，每层具多条细密螺旋肋，壳色灰白至淡褐。壳口小，近圆形。',
    生境: '浅海沙泥底质，多在潮下带至数十米水深，营底内埋栖或半埋栖生活，以鳃滤食有机碎屑与浮游生物。',
    备注: '标本标签写作 Turritella terebra bacillum（亚种／变种级），WoRMS 与 NCBI 现均按 Turritella terebra 处理，未承认该亚种。',
  },
  'Babylonia areolata': {
    形态: '壳卵圆锥形、坚实，壳面光滑，具褐色方形斑块；壳口宽，内唇具肋状齿。',
    生境: '潮下带沙泥底，肉食性，捕食小型双壳类与腐肉；我国海南、广东、福建沿海重要养殖对象（方斑东风螺）。',
    备注: '标签科名写作「蛾螺科」(Buccinidae)；WoRMS 现归入东风螺科 (Babyloniidae)，NCBI 分类仍列于 Buccinidae，两种口径并存。',
  },
  'Cerithium vulgatum': {
    形态: '壳小型、细长塔形，螺层多，表面具颗粒状或结节状突起与螺旋纹，壳色暗褐。',
    生境: '潮间带至浅海岩礁、海藻丛与碎石底，刮食附着藻类与有机膜，地中海及东大西洋常见种。',
    备注: '该物种在 NCBI 仅有 3 条微卫星序列、无公开 COI 条形码，故本站序列模块对其标注「无公开 COI」。WoRMS 接受名为 Thericium vulgatum。',
  },
  'Thais tuberosa': {
    形态: '壳厚重、卵圆形，体螺层具明显瘤状突起与短棘，壳面灰褐至紫褐色，壳口内缘具齿。',
    生境: '潮间带至浅海岩礁，肉食性，可钻穿双壳类贝壳取食，是牡蛎与珍珠贝养殖的主要敌害之一。',
    备注: '标签科名写作「荔螺科」，现行分类为骨螺科 (Muricidae)；WoRMS 接受名为 Menathais tuberosa，GenBank 中同名记录亦以 Menathais 标注。',
  },
  'Sinonovacula constricta': {
    形态: '壳薄、长椭圆形，两端开口，壳顶略靠前端，壳顶后方有一条斜向缢痕（故名「缢蛏」），壳表黄绿至灰白。',
    生境: '潮间带中低潮区软泥滩，穴居深度可达 30–50 cm，广温广盐，滤食性；我国浙、闽沿海大规模养殖。',
    备注: '标签科名「竹蛏科」(Pharidae) 与 WoRMS 一致；NCBI 分类将其置于 Solecurtidae，属分类数据库间差异，非标签错误。',
  },
  'Tegillarca granosa': {
    形态: '壳坚厚、卵圆形，放射肋粗壮（约 18–20 条），肋上具颗粒状结节，壳表被褐色壳皮与细绒毛。',
    生境: '潮间带泥滩埋栖，广温广盐，滤食性；血淋巴含血红蛋白故称「血蚶」，我国沿海传统养殖贝类。',
    备注: '标签用「双壳纲」，为「瓣鳃纲」的同物异名，二者均指 Bivalvia。',
  },
  'Mytilus edulis': {
    形态: '壳楔形、薄而韧，壳表黑紫至蓝黑色，壳顶位于前端，腹缘略直，以足丝附着于硬质基底。',
    生境: '潮间带至浅海岩礁、码头桩柱与养殖浮筏，滤食性，形成密集贝床，是重要经济贝类与生态工程种。',
    备注: '我国养殖的「紫贻贝」在部分文献中记为地中海贻贝 Mytilus galloprovincialis，二者形态与分布高度重叠；本站按标本标签采用 M. edulis。',
  },
  'Chlamys farreri': {
    形态: '壳扇形、左右壳略不等，具放射肋 20 余条，肋上具小鳞片，前耳下方有足丝孔（栉孔），壳色多变。',
    生境: '浅海岩礁与砾石底，以足丝附着生活，滤食性；我国黄渤海主要养殖扇贝（栉孔扇贝）。',
    备注: 'Chlamys farreri 为旧组合，WoRMS 接受名为 Scaeochlamys farreri，NCBI 采用 Azumapecten farreri，三个属名指同一物种。',
  },
  'Ruditapes variegatus': {
    形态: '壳三角卵圆形、较薄，壳面平滑，具褐色锯齿状或放射状色斑，壳内面可见外套窦。',
    生境: '潮间带至浅海沙泥底埋栖，滤食性，常见于我国南方沿海滩涂。',
    备注: '标签学名 Ruditapes variegatus 现被视为 Ruditapes aspera 的次定同物异名（WoRMS）；GenBank 中另有大量以 Venerupis variegata 发表的记录。',
  },
  'Monetaria annulus': {
    形态: '壳卵圆形、光滑，背部隆起，具一圈橙黄色环纹，环纹外侧灰白；齿列短而粗。',
    生境: '热带珊瑚礁区潮间带至浅水，行动缓慢，以藻类与碎屑为食；历史上曾作货币使用。',
    备注: '标签学名 Monetaria annulus 与 WoRMS 一致，旧组合为 Cypraea annulus。',
  },
};

const ORDER_CN = {
  'Caenogastropoda incertae sedis': '新腹足类（地位未定）', Neogastropoda: '新腹足目', Littorinimorpha: '滨螺目',
  Adapedonta: '贫齿目', Arcida: '蚶目', Mytilida: '贻贝目', Pectinida: '扇贝目', Venerida: '帘蛤目',
};

const out = [];
const fastaIndex = [];

raw.forEach((s, i) => {
  const w = worms.find(x => x.cn === s.cn) || {};
  const primary = w[s.sci] || w[w.alt] || {};
  const accepted = primary.valid_name || primary.scientificname || s.sci;
  const statusMap = {
    accepted: { zh: '接受名', ok: true },
    'superseded combination': { zh: '旧组合（属名已变更）', ok: false },
    'junior subjective synonym': { zh: '次定同物异名（已归并）', ok: false },
  };
  const st = statusMap[primary.status] || { zh: primary.status || '未核实', ok: false };
  const familyLa = primary.family || (s.tax?.lin.find(x => x.rank === 'family')?.name) || '';
  const clsLa = primary.class || (s.tax?.lin.find(x => x.rank === 'class')?.name) || '';
  const c = CONTENT[s.sci] || {};

  // 过滤出有意义的分类阶元
  const keepRanks = ['phylum', 'class', 'subclass', 'order', 'superfamily', 'family', 'genus'];
  const lineage = (s.tax?.lin || []).filter(x => keepRanks.includes(x.rank))
    .map(x => ({ rank: x.rank, name: x.name }));

  // 尖锥蟹守螺：NCBI 无 COI，仅有 3 条微卫星序列 —— 不能冒充条形码
  const isBarcode = s.sci !== 'Cerithium vulgatum';
  const coi = isBarcode ? (s.coi || []).map(r => ({ acc: r.acc, len: r.len, gc: r.gc, def: r.def, seq: r.seq })) : [];
  const otherSeq = isBarcode ? [] : (s.coi || []).map(r => ({ acc: r.acc, len: r.len, gc: r.gc, def: r.def, kind: '微卫星（非条形码）' }));

  const rec = {
    id: `MOL-${String(i + 1).padStart(2, '0')}`,
    cn: s.cn,
    sciLabel: s.sci,
    sciAccepted: accepted,
    synonyms: [...new Set([w.alt, ...(s.alt || [])].filter(Boolean).filter(x => x !== s.sci))],
    nameStatus: st.zh,
    nameOk: st.ok,
    unacceptReason: primary.unacceptreason || '',
    authority: primary.authority || '',
    classLa: clsLa, classZh: ZH_CLASS[clsLa] || clsLa,
    familyLa, familyZh: ZH_FAMILY[familyLa] || familyLa,
    orderLa: primary.order || '',
    orderZh: ORDER_CN[primary.order] || primary.order || '',
    taxidNcbi: s.taxid,
    aphiaId: primary.AphiaID || null,
    lineage,
    morphology: c.形态 || '',
    habitat: c.生境 || '',
    note: c.备注 || '',
    coi, coiCount: s.coiCount || 0,
    otherSeq,
    genomes: (s.genomes || []).map(g => ({ acc: g.acc, name: g.name, level: g.level, size: g.size, n50: g.n50, gc: g.gc })),
    refseqProtein: s.refseqProtein || 0,
    nucleotide: s.nucleotide || 0,
  };
  out.push(rec);

  if (coi.length) {
    const fa = coi.map(r => `>${s.cn}_${s.sci.replace(/ /g, '_')}|${r.acc}|len=${r.len}|GC=${r.gc}%\n${r.seq.replace(/(.{70})/g, '$1\n')}`).join('\n');
    writeFileSync(`${D}data\\fasta\\${rec.id}_${s.sci.replace(/ /g, '_')}.fasta`, fa + '\n', 'utf8');
    fastaIndex.push({ id: rec.id, file: `${rec.id}_${s.sci.replace(/ /g, '_')}.fasta`, n: coi.length });
  }
});

const stats = {
  species: out.length,
  coiRecords: out.reduce((a, s) => a + s.coi.length, 0),
  genomes: out.reduce((a, s) => a + s.genomes.length, 0),
  speciesWithGenome: out.filter(s => s.genomes.length).length,
  totalCoiPublic: out.reduce((a, s) => a + s.coiCount, 0),
  refseqProtein: out.reduce((a, s) => a + s.refseqProtein, 0),
  gastropoda: out.filter(s => s.classLa === 'Gastropoda').length,
  bivalvia: out.filter(s => s.classLa === 'Bivalvia').length,
  generated: '2026-11-02',
  sources: ['NCBI E-utilities (nuccore / taxonomy / assembly)', 'NCBI Datasets API', 'WoRMS (marinespecies.org)'],
};

writeFileSync(D + 'data\\species.json', JSON.stringify({ stats, species: out, fasta: fastaIndex }, null, 1), 'utf8');
console.log('species:', out.length, '| COI:', stats.coiRecords, '| 基因组:', stats.genomes, '| 有基因组的物种:', stats.speciesWithGenome);
out.forEach(s => console.log(`  ${s.id} ${s.cn.padEnd(6)} ${s.sciLabel.padEnd(24)} -> ${s.sciAccepted.padEnd(24)} [${s.nameStatus}] COI=${s.coi.length}/${s.coiCount} 基因组=${s.genomes.length}`));
