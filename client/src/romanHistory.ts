// The town's history book: short lessons on real Roman history, one per
// place in town. Every lesson names its sources (at least one ancient
// author with a precise citation, and at least one modern reference).
// Where this town's own version departs from history, `townNote` says so
// plainly. The town's story (Aelia, the Two Lanterns, the letters) is
// fiction and never appears here.

export type HistorySource = { cite: string; url?: string };

export type HistoryLesson = {
  id: string;
  placeId: string;
  title: string;
  period: string;
  text: string;
  sources: HistorySource[];
  townNote?: string;
  /** The words cut in the stone where the lesson stands in town (Tasks 54, 55), shown first. */
  inscription?: string;
};

const LACUS = "https://penelope.uchicago.edu/Thayer/E/Roman/Texts";
const PERSEUS = "https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A";

export const HISTORY_BOOK_INTRO: string =
  "This is the town's history book: short lessons about the real Rome, one for each place you can walk to. " +
  "Every lesson names its sources, an ancient writer you can look up and a modern historian or museum, and says 'about' or 'probably' where historians are not sure. " +
  "The town's own story (Aelia, the Two Lanterns constellation, the letters) is fiction, and it is kept separate from these pages.";

export const HISTORY_LESSONS: HistoryLesson[] = [
  {
    id: "forum-romanum",
    placeId: "forum",
    title: "The Forum: Rome's town square",
    period: "Used from about 600 BC to late antiquity",
    text:
      "The Roman Forum began as a marshy valley between hills. Roman tradition, told by Livy, says the early king Tarquinius Priscus drained it with channels into the Tiber, and archaeology suggests the valley was probably filled and first paved around 600 BC. " +
      "It became the centre of public life: speakers addressed crowds from the Rostra, the senate met in the Curia, and shops, temples and law courts lined the square. " +
      "Time was kept here too. Pliny the Elder, following Varro, says the first public sundial in Rome was set up near the Rostra in 263 BC, taken as war loot from Catania in Sicily. " +
      "It was made for a different latitude, so it never told Rome's hours correctly, yet Romans used it for 99 years.",
    sources: [
      {
        cite: "Livy, History of Rome 1.38.6 (draining the low ground round the Forum)",
        url: `${PERSEUS}1999.02.0026%3Abook%3D1%3Achapter%3D38`,
      },
      {
        cite: "Pliny the Elder, Natural History 7.213-215 (the first sundials at Rome)",
        url: `${PERSEUS}1999.02.0137%3Abook%3D7%3Achapter%3D60`,
      },
      { cite: "Filippo Coarelli, Rome and Environs: An Archaeological Guide (updated ed., 2014), 'The Roman Forum'" },
    ],
    townNote:
      "This town's forum is a small market square made for the game. It is not a copy of the Roman Forum, which is far larger and is in Rome; the lesson describes the real one.",
  },
  {
    id: "basilica-hall",
    placeId: "basilica",
    title: "The basilica: a hall for business and law",
    period: "From 184 BC (the first basilica in Rome)",
    text:
      "A Roman basilica was not a church. It was a large roofed hall beside the forum where people met, traded, and went to court, out of the sun and rain. " +
      "Livy records that Cato, as censor in 184 BC, bought land by the Forum and built the Basilica Porcia, the first basilica in Rome. Others followed, including the Basilica Aemilia and the Basilica Julia, begun by Julius Caesar. " +
      "The architect Vitruvius advised building it on the warmest side of the forum, so merchants could gather there in winter. " +
      "Centuries later, Christians borrowed this long hall plan for their churches, which is why many churches are still called basilicas today.",
    sources: [
      {
        cite: "Livy, History of Rome 39.44.7 (Cato builds the Basilica Porcia)",
        url: `${PERSEUS}1999.02.0144%3Abook%3D39%3Achapter%3D44`,
      },
      { cite: "Vitruvius, On Architecture 5.1.4", url: `${LACUS}/Vitruvius/5*.html` },
      { cite: "Filippo Coarelli, Rome and Environs: An Archaeological Guide (updated ed., 2014), on the Basilica Aemilia and Basilica Julia" },
    ],
    townNote:
      "In this town the basilica is the great hall where letters arrive and the project board hangs, a meeting place in the game. That use is close in spirit to a real basilica, but the building itself is invented.",
  },
  {
    id: "roman-temple",
    placeId: "temple",
    title: "A Roman temple: the god's house",
    period: "Temples of this form were built from about the 500s BC through the empire",
    text:
      "A Roman temple was a house for a god, not a hall for worshippers. Inside, in a room called the cella, stood the god's statue. " +
      "Worship happened outdoors: people gathered at an altar in front of the steps, where priests offered prayers and sacrifices. " +
      "Typical Roman temples stood on a high platform (a podium) with steps and columns only at the front, a design that came from Italy's Etruscan neighbours. " +
      "Vitruvius advised that, where the site allowed, the statue should face west, so worshippers at the altar faced east toward the god. " +
      "A well preserved example is the Temple of Portunus in Rome, built around 120 to 80 BC, which survived because it later became a church.",
    sources: [
      { cite: "Vitruvius, On Architecture 4.5.1 (temples face west) and 4.9.1 (altars face east)", url: `${LACUS}/Vitruvius/4*.html` },
      { cite: "Mary Beard, John North and Simon Price, Religions of Rome, vol. 1 (Cambridge, 1998)" },
      { cite: "Smarthistory, 'Temple of Portunus, Rome'", url: "https://smarthistory.org/temple-of-portunus/" },
    ],
    townNote:
      "This town's temple on the hill is a generic Roman temple, not any real one, and it belongs to no named god. The Temple of Portunus is mentioned as a real example to compare it with.",
  },
  {
    id: "roman-baths",
    placeId: "baths",
    title: "The baths: a daily Roman habit",
    period: "Public baths spread in Italy from about the 100s BC; Baths of Caracalla dedicated AD 216",
    text:
      "Most Romans had no bath at home, so they went to public baths, often every afternoon. A visit moved from room to room: a changing room, a cold room (frigidarium), a warm room (tepidarium) and the hot room, the caldarium. " +
      "The heat came from furnaces whose hot air flowed under raised floors and through the walls, a system called a hypocaust. Vitruvius describes floors set on small pillars over the furnace, and advises facing the hot rooms toward the afternoon sun. " +
      "Baths were noisy social places. The philosopher Seneca, who lived above one, complained of grunting weightlifters, splashing swimmers, and sellers shouting about cakes and sausages.",
    sources: [
      { cite: "Vitruvius, On Architecture 5.10.1-2", url: `${LACUS}/Vitruvius/5*.html` },
      {
        cite: "Seneca, Moral Letters to Lucilius 56.1-2 (trans. R. M. Gummere)",
        url: "https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_56",
      },
      { cite: "Fikret Yegul, Baths and Bathing in Classical Antiquity (MIT Press, 1992)" },
    ],
    townNote:
      "The town's bath house is small and simplified, with a caldarium to visit. Real baths ranged from neighbourhood bath houses to huge imperial complexes like the Baths of Caracalla.",
  },
  {
    id: "market-prices",
    placeId: "market",
    title: "Markets, and an emperor who tried to fix prices",
    period: "Edict on Maximum Prices, AD 301",
    text:
      "Romans bought food at street stalls, small shops and covered food markets (a macellum) selling meat, fish and produce. " +
      "We know many prices because of a law. In AD 301 the emperor Diocletian issued an Edict on Maximum Prices, setting the highest legal price for well over a thousand goods and services, from wheat and wine to a barber's shave. " +
      "No complete copy survives; historians have pieced the text together from many inscribed fragments, mostly found in the eastern provinces. " +
      "It did not work. The Christian writer Lactantius, who disliked Diocletian, says traders hid their goods, scarcity grew worse, blood was shed over trifles, and the law was dropped.",
    sources: [
      {
        cite: "Lactantius, On the Deaths of the Persecutors 7.6-7",
        url: "https://www.newadvent.org/fathers/0705.htm",
      },
      { cite: "Diocletian, Edict on Maximum Prices (AD 301), preserved in inscriptions" },
      { cite: "Claire Holleran, Shopping in Ancient Rome: The Retail Trade in the Late Republic and the Principate (Oxford, 2012)" },
      { cite: "Simon Corcoran, The Empire of the Tetrarchs (rev. ed., Oxford, 2000)" },
    ],
    townNote:
      "The town's stalls are invented and sell what the game needs. The prices in the edict are real, but they come from AD 301 and from one emperor's law.",
  },
  {
    id: "colosseum-flavian",
    placeId: "colosseum",
    title: "The Colosseum",
    period: "Begun about AD 70-72 under Vespasian; opened AD 80 by Titus",
    text:
      "The emperor Vespasian began a great amphitheatre in the heart of Rome, a plan Suetonius says Augustus had once cherished. It rose on the site of the lake in Nero's palace grounds. " +
      "His son Titus opened it in AD 80 with games that, according to Cassius Dio, lasted a hundred days, with some nine thousand animals killed. " +
      "Romans called it the Flavian Amphitheatre, after the family of emperors who built it. The name Colosseum came later, probably from a colossal statue that stood nearby. " +
      "It probably held about 50,000 people, though estimates vary. Crowds came to see gladiators, wild beast hunts and executions.",
    sources: [
      { cite: "Suetonius, Life of Vespasian 9.1", url: `${LACUS}/Suetonius/12Caesars/Vespasian*.html` },
      { cite: "Suetonius, Life of Titus 7.3", url: `${LACUS}/Suetonius/12Caesars/Titus*.html` },
      { cite: "Cassius Dio, Roman History 66.25.1 and 66.25.4", url: `${LACUS}/Cassius_Dio/66*.html` },
      { cite: "Keith Hopkins and Mary Beard, The Colosseum (Harvard, 2005)" },
      { cite: "Encyclopaedia Britannica, 'Colosseum'", url: "https://www.britannica.com/topic/Colosseum" },
    ],
    townNote:
      "The real Colosseum stands in Rome and is still there, ruined. This town's Colosseum is a model shown 'in its prime', placed in a small town for the game, and much smaller than the real one.",
  },
  {
    id: "villa-library",
    placeId: "villa",
    title: "Reading at a Roman villa",
    period: "Pliny's letter about AD 100; Villa of the Papyri buried AD 79",
    text:
      "Wealthy Romans kept country houses, villas, where they rested, wrote and read. " +
      "Pliny the Younger describes his villa near the sea at Laurentum, south of Rome. In a sunny curved room, he writes, cases are built into the wall holding books that can never be read too often. " +
      "Roman books were scrolls of papyrus. A whole villa library survives, burnt to charcoal, at Herculaneum: the Villa of the Papyri, buried by Vesuvius in AD 79 and dug into in the 1750s. " +
      "It held well over a thousand scrolls (counts differ), many by the philosopher Philodemus. Scholars are still learning to read them.",
    sources: [
      {
        cite: "Pliny the Younger, Letters 2.17.8 (trans. W. Melmoth, rev. F. C. T. Bosanquet)",
        url: "https://www.gutenberg.org/ebooks/2811",
      },
      { cite: "J. Paul Getty Museum, 'The Herculaneum Villa of the Papyri' (exhibition)", url: "https://www.getty.edu/art/exhibitions/villa_papiri/" },
      { cite: "David Sider, The Library of the Villa dei Papiri at Herculaneum (Getty Publications, 2005)" },
    ],
    townNote:
      "The 'Villa of Stories' is the town's own reading room and its stories are the game's fiction. It is not modelled on any one real villa.",
  },
  {
    id: "aqueducts",
    placeId: "aqueduct",
    title: "Aqueducts: water by gravity",
    period: "Rome's first aqueduct 312 BC; Frontinus wrote about AD 97",
    text:
      "Frontinus, who ran Rome's water supply around AD 97, wrote a book about it. He says that for 441 years after the city's founding Romans drank from the Tiber, wells and springs, until the censor Appius Claudius brought in the first aqueduct, the Aqua Appia, in 312 BC. " +
      "Aqueducts worked by gravity alone, sloping gently downhill over many kilometres. Most of their length ran underground; the famous arches were built only where a channel had to cross a valley. " +
      "Frontinus was proud of them: compare, he writes, 'the idle Pyramids or the useless, though famous, works of the Greeks'. " +
      "A great surviving valley crossing is the Pont du Gard in France, almost 50 metres high.",
    sources: [
      {
        cite: "Frontinus, On the Water Supply of Rome (De aquaeductu) 1.4, 1.5 and 1.16 (trans. C. E. Bennett, Loeb, 1925)",
        url: `${LACUS}/Frontinus/De_Aquis/Bennett/1*.html`,
      },
      { cite: "A. Trevor Hodge, Roman Aqueducts and Water Supply (2nd ed., Duckworth, 2002)" },
      { cite: "UNESCO World Heritage Centre, 'Pont du Gard (Roman Aqueduct)'", url: "https://whc.unesco.org/en/list/344/" },
    ],
    townNote:
      "The town's aqueduct is invented and short, and it carries no real water source. Real aqueducts ran for many kilometres from springs in the hills.",
  },
  {
    id: "arch-of-titus",
    placeId: "arch",
    title: "The triumphal arch",
    period: "Arch of Titus, built soon after AD 81 under Domitian",
    text:
      "Romans built arches to honour victories and emperors. The oldest of Rome's surviving triumphal arches is the Arch of Titus on the Sacred Way, put up by his brother Domitian after Titus died in AD 81. Its inscription calls him 'divus', deified. " +
      "It remembers the capture of Jerusalem in AD 70. One carved panel shows soldiers carrying the treasures of the Jewish Temple, with the seven-branched lampstand, the menorah, in the triumph of AD 71. " +
      "The historian Josephus, who saw that procession, describes the golden table and the lampstand with its seven lamps carried through the streets.",
    sources: [
      { cite: "Josephus, The Jewish War 7.5.5 (7.148-150 in the modern numbering)", url: "https://www.gutenberg.org/ebooks/2850" },
      { cite: "Inscription of the Arch of Titus, CIL VI 945" },
      { cite: "Smarthistory, 'The Arch of Titus'", url: "https://smarthistory.org/the-arch-of-titus/" },
      { cite: "Encyclopaedia Britannica, 'Arch of Titus'", url: "https://www.britannica.com/place/Arch-of-Titus" },
    ],
    townNote:
      "The town's arch stands at a villa gate and honours no real event. Real triumphal arches stood on public streets, and the Arch of Titus is in Rome, between the Forum and the Colosseum.",
  },
  {
    id: "meta-sudans",
    placeId: "fountain",
    title: "The Meta Sudans, the sweating fountain",
    period: "Rebuilt in the Flavian era, probably under Domitian (late 1st century AD); demolished 1936",
    text:
      "Beside the Colosseum stood a tall cone-shaped fountain called the Meta Sudans, the 'sweating turning-post'. Water seeped over its surface, as if it were sweating, into a round basin. Its name compares it to the cone-shaped posts at the ends of a chariot racetrack. " +
      "An earlier fountain stood here before the Colosseum: Seneca, writing before AD 65, mentions a man testing his pipes and flutes at the 'Trickling' fountain. Excavations in the late twentieth century found traces of an earlier fountain nearby. " +
      "The Flavian fountain, of brick and concrete, may have stood about 17 metres high. Its ruined core survived until 1936, when Mussolini had it cleared for a road. Its foundations have since been excavated.",
    sources: [
      {
        cite: "Seneca, Moral Letters to Lucilius 56.4 (trans. R. M. Gummere)",
        url: "https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_56",
      },
      { cite: "Clementina Panella (ed.), Meta Sudans I: Un'area sacra in Palatio e la valle del Colosseo prima e dopo Nerone (Rome, 1996)" },
      { cite: "Filippo Coarelli, Rome and Environs: An Archaeological Guide (updated ed., 2014), 'Meta Sudans'" },
    ],
    townNote:
      "The real Meta Sudans stood beside the Colosseum in Rome and only its foundations remain. The town's fountain is a restored copy, imagined whole and working, and its size is the game's.",
  },
  {
    id: "mars",
    placeId: "mars",
    title: "Mars, father of Rome",
    period: "Temple of Mars Ultor vowed 42 BC, dedicated 2 BC",
    text:
      "Mars was the Roman god of war, and also a guardian of farms and fields: the farmer Cato records a prayer to 'Father Mars' to protect crops and herds. " +
      "In Roman legend he was the father of the twins Romulus and Remus. Livy, telling the story, notes that their mother may have named Mars to excuse herself. " +
      "The month of March is named after him, and the Campus Martius, the Field of Mars, was where the army once mustered. " +
      "Augustus vowed a temple to Mars the Avenger (Mars Ultor) at the battle of Philippi in 42 BC and built it in his new forum, dedicated in 2 BC.",
    sources: [
      { cite: "Livy, History of Rome 1.4.2", url: `${PERSEUS}1999.02.0026%3Abook%3D1%3Achapter%3D4` },
      { cite: "Cato the Elder, On Agriculture 141 (the prayer to Mars)" },
      { cite: "Suetonius, Life of Augustus 29.1-2", url: `${LACUS}/Suetonius/12Caesars/Augustus*.html` },
      { cite: "Augustus, Res Gestae 21", url: `${LACUS}/Augustus/Res_Gestae/4*.html` },
      { cite: "Mary Beard, John North and Simon Price, Religions of Rome, vol. 1 (Cambridge, 1998)" },
    ],
    townNote:
      "The town's statue of Mars is an invented figure, not a copy of a known ancient statue, and it stands in the open rather than in a temple.",
  },
  {
    id: "ballista",
    placeId: "ballista",
    title: "The ballista: a giant torsion crossbow",
    period: "Torsion artillery from the 300s BC; Vitruvius wrote about 30-20 BC",
    text:
      "Roman armies used artillery powered by twisted ropes. Two arms were set into tight bundles of cord; pulling them back twisted the cord further, and releasing them flung a stone or a heavy bolt. " +
      "The Romans took this idea from Greek engineers. Vitruvius, who served as a military engineer, gives the rules for building them and says the springs were made of hair or of animal sinew, sized to the weight of stone to be thrown. " +
      "Names changed over time. For Vitruvius a ballista threw stones and a catapult shot arrows; later Roman writers used 'ballista' for bolt-shooters too.",
    sources: [
      { cite: "Vitruvius, On Architecture 10.10-11 (10.11.2 on the cords)", url: `${LACUS}/Vitruvius/10*.html` },
      { cite: "Ammianus Marcellinus, Roman History 23.4.1-3 (the later bolt-shooting ballista)" },
      { cite: "E. W. Marsden, Greek and Roman Artillery: Historical Development (Oxford, 1969)" },
      { cite: "Duncan B. Campbell, Greek and Roman Artillery 399 BC-AD 363 (Osprey, 2003)" },
    ],
    townNote:
      "The town's ballista is a peaceful display piece. Real ones belonged to legions and city walls, and were built to kill.",
  },
  {
    id: "roman-sky",
    placeId: "pavilion",
    title: "How Romans knew the sky and the year",
    period: "Julian calendar from 45 BC; Ptolemy's star catalogue about AD 150",
    text:
      "Romans learned the constellations mostly from a Greek poem, the Phaenomena of Aratus, which Cicero and later Germanicus put into Latin verse. " +
      "About AD 150, the astronomer Ptolemy in Alexandria listed 1,022 stars in 48 constellations in his Almagest, with each star's place and brightness. Nearly all of his 48 are still among the constellations astronomers use today. " +
      "The calendar was fixed to the sky by Julius Caesar. With the astronomer Sosigenes he made the year 365 days with an extra day every fourth year. Suetonius says the year of the change, 46 BC, had to be stretched to fifteen months to put the seasons back in place.",
    sources: [
      { cite: "Ptolemy, Almagest 7.5-8.1 (the star catalogue)" },
      { cite: "Suetonius, Life of Julius Caesar 40.1-2", url: `${LACUS}/Suetonius/12Caesars/Julius*.html` },
      {
        cite: "Pliny the Elder, Natural History 18.211 (Sosigenes)",
        url: `${PERSEUS}1999.02.0137%3Abook%3D18%3Achapter%3D57`,
      },
      { cite: "Encyclopaedia Britannica, 'Astronomical map: the constellations and other sky divisions'", url: "https://www.britannica.com/science/astronomical-map/The-constellations-and-other-sky-divisions" },
    ],
    townNote:
      "The Two Lanterns constellation you may see from the pavilion is the town's own invention, laid over the real sky. No Roman knew it.",
  },
  {
    id: "roman-garden",
    placeId: "garden",
    title: "The Roman garden, the hortus",
    period: "From early Rome; Pompeii's gardens buried AD 79",
    text:
      "For Romans a garden, a hortus, was first of all food. Pliny the Elder says that in old Rome the garden was the poor man's field, where ordinary people grew their daily vegetables, and that the ancient laws of the Twelve Tables used the word hortus for a farm. " +
      "In towns, a house often wrapped around a garden courtyard with a colonnade, a peristyle, planted with fruit trees, herbs and flowers. " +
      "At Pompeii, buried in AD 79, the archaeologist Wilhelmina Jashemski filled the hollows left by ancient roots with plaster, recovering where real trees and vines once grew.",
    sources: [
      {
        cite: "Pliny the Elder, Natural History 19.49-52",
        url: `${PERSEUS}1999.02.0137%3Abook%3D19%3Achapter%3D19`,
      },
      { cite: "Wilhelmina F. Jashemski, The Gardens of Pompeii, Herculaneum and the Villas Destroyed by Vesuvius (2 vols., 1979-1993)" },
    ],
    townNote:
      "The town's garden house and its plants are designed for the game, not reconstructed from a particular Roman garden.",
  },
  {
    id: "roman-kitchen",
    placeId: "kitchen",
    title: "The Roman kitchen and garum",
    period: "Garum from the Republic onward; the Apicius cookbook compiled probably in the late 300s or 400s AD",
    text:
      "The favourite Roman seasoning was garum, a salty fish sauce. Pliny the Elder explains that it was made from fish guts and scraps left to break down in salt, and that the best kinds were costly. He names Pompeii among the towns famous for it. " +
      "Our main Roman cookbook goes by the name of Apicius, a famous gourmet who lived under the emperor Tiberius. The collection we have was put together much later, probably in the late 300s or the 400s AD, and many of its recipes call for fish sauce. " +
      "Many city people lived in flats with no proper kitchen, and bought hot food at street counters.",
    sources: [
      {
        cite: "Pliny the Elder, Natural History 31.93-94",
        url: `${PERSEUS}1999.02.0137%3Abook%3D31%3Achapter%3D43`,
      },
      { cite: "Apicius, On Cookery (De re coquinaria)", url: "https://www.gutenberg.org/ebooks/16439" },
      { cite: "Sally Grainger and Christopher Grocock, Apicius: A Critical Edition with an Introduction and an English Translation (Prospect Books, 2006)" },
      { cite: "Sally Grainger, The Story of Garum: Fermented Fish Sauce and Salted Fish in the Ancient World (Routledge, 2021)" },
    ],
    townNote:
      "The town's kitchen and its recipes are the game's. Where a dish is meant to be Roman, it should be checked against Apicius before it is called authentic.",
  },
  {
    id: "lucretia",
    placeId: "lucretia",
    title: "Lucretia, and the end of Rome's kings",
    period: "A legend set in 509 BC, written down by Livy about five hundred years later",
    inscription: "LVCRETIA. Her courage, as Livy tells it, ended the rule of kings in Rome.",
    text:
      "Lucretia was a Roman noblewoman, the wife of Collatinus, remembered in Roman tradition for her virtue and her courage. " +
      "Livy tells how Sextus Tarquinius, son of the last king, Tarquin the Proud, assaulted her. She sent for her father and her husband, told them the truth, asked them to promise her justice, and then took her own life. " +
      "Over her body Lucius Junius Brutus swore an oath to drive the kings from Rome. The people rose, the royal family was exiled, and Rome became a republic, ruled by two consuls elected each year. " +
      "Historians treat the story as legend rather than record: it was written down centuries later and shaped to teach Roman values, though the end of the monarchy around 509 BC is generally accepted.",
    sources: [
      { cite: "Livy, History of Rome 1.57-60", url: `${PERSEUS}1999.02.0026%3Abook%3D1%3Achapter%3D57` },
      { cite: "Ovid, Fasti 2.721-852" },
      { cite: "T. J. Cornell, The Beginnings of Rome (London, 1995), chapter 9" },
      { cite: "Mary Beard, SPQR: A History of Ancient Rome (London, 2015), chapter 3" },
    ],
    townNote:
      "The statue is the town's own. No ancient portrait of Lucretia is known, so her figure, the rose at her feet and her place in the forum garden, facing the evening light, are invented: a tribute, not a copy.",
  },
  {
    id: "minerva",
    placeId: "athena",
    title: "Athena, called Minerva in Rome",
    period: "Minerva honoured on the Capitol from about 509 BC",
    inscription: "ATHENA, called Minerva by the Romans: wisdom, craft, and the olive.",
    text:
      "The Greeks honoured Athena as the goddess of wisdom, of crafts and of the defence of cities. Herodotus tells the Athenian story that she won their city by giving it the olive tree, which grew on the Acropolis. " +
      "The Romans identified her with their own goddess Minerva. Minerva shared Rome's greatest temple, on the Capitoline Hill, with Jupiter and Juno, a temple Livy says was dedicated in the first year of the Republic. " +
      "She was the patron of craftsmen, teachers, doctors and weavers, and her festival, the Quinquatrus, was kept each March, as Ovid describes. " +
      "The olive was everywhere in Roman life: its oil was food, lamplight and soap.",
    sources: [
      { cite: "Herodotus, Histories 8.55 (the olive on the Acropolis)", url: `${PERSEUS}1999.01.0126%3Abook%3D8%3Achapter%3D55` },
      { cite: "Livy, History of Rome 2.8.6-8 (the Capitoline temple dedicated)", url: `${PERSEUS}1999.02.0026%3Abook%3D2%3Achapter%3D8` },
      { cite: "Ovid, Fasti 3.809-848 (the Quinquatrus)" },
      { cite: "Mary Beard, John North and Simon Price, Religions of Rome, vol. 1 (Cambridge, 1998)" },
    ],
    townNote:
      "The temple is the town's own, small and invented, and it carries her Greek name, Athena, beside the Roman one; a temple in a Roman town would have been Minerva's. It faces east, toward Lucretia, though Vitruvius advised that temples face west.",
  },
];
