/* Date statice de rezervă — muzeu + săli (fără obiecte).
 * Sursa de adevăr pentru obiecte: content/obiecte/*.json (Pages CMS).
 * cms.js suprascrie MUZEU.obiecte cu fișele din content/ la boot. */
const MUZEU = {
  "muzeu": {
    "nume": "Muzeul Național al Republicii Moldova",
    "sunet": true
  },
  "sali": [
    {
      "id": "sala-documentelor",
      "nume": "Sala Documentelor",
      "icon": "📜",
      "perete": "#2b4f46",
      "lambriu": "#4f3d22",
      "descriere": "Acte, cataloage, hărți și fotografii. Amintiri pe hârtie.",
      "obiecte_tipice": [
        "Acte și adeverințe vechi",
        "Cataloage școlare",
        "Fotografii de familie",
        "Hărți și planuri",
        "Ziare și reviste de epocă",
        "Diplome și certificate"
      ],
      "invitatie": "Ai un act vechi, o fotografie de familie sau un catalog de la școala ta? Poveștește-ne despre el — devine filă în sala asta."
    },
    {
      "id": "sala-scolii",
      "nume": "Sala Școlii",
      "icon": "🎓",
      "perete": "#2a3a62",
      "lambriu": "#633917",
      "descriere": "Bănci, clopoțel și rechizite. Clasa de acum 50 de ani.",
      "obiecte_tipice": [
        "Clopoțel de clasă",
        "Bănci și scaune vechi",
        "Abac și penare",
        "Manuale și caiete",
        "Aparate didactice",
        "Steme și diplome"
      ],
      "invitatie": "Păstrezi ceva de la școala ta — un clopoțel, un penar, o bancă? Adu-l în colecție cu povestea lui."
    },
    {
      "id": "sala-naturii",
      "nume": "Sala Naturii",
      "icon": "🌿",
      "perete": "#3d5c2a",
      "lambriu": "#37411f",
      "descriere": "Ierbare, pietre și microscoape. Cabinetul curioșilor.",
      "obiecte_tipice": [
        "Ierbare și plante presate",
        "Pietre și minerale",
        "Microscoape și lupe",
        "Panouri cu insecte",
        "Hărți de relief"
      ],
      "invitatie": "Ai un ierbar al bunicii sau o piatră adusă din excursii? Naturii îi stau bine poveștile trăite."
    },
    {
      "id": "sala-mestesugurilor",
      "nume": "Sala Meșteșugurilor",
      "icon": "⚒️",
      "perete": "#6b3220",
      "lambriu": "#2a160e",
      "descriere": "Război de țesut, ceramică și costume. Mâinile bunicilor.",
      "obiecte_tipice": [
        "Costume populare",
        "Războaie de țesut",
        "Ceramică și oale",
        "Unelte de lemn",
        "Broderii și ștergare",
        "Coșuri împletite"
      ],
      "invitatie": "Ai în casă o țesătură, o oală pictată sau uneltele bunicului? Mâinile lor au povestit destul — lasă-ne pe noi să continuăm."
    },
    {
      "id": "sala-gospodariei",
      "nume": "Sala Gospodăriei",
      "icon": "🏺",
      "perete": "#7a5c22",
      "lambriu": "#7a5426",
      "descriere": "Vase, lămpi, ceasuri și aparate de odinioară. Casa bunicii.",
      "obiecte_tipice": [
        "Vase și oale de fontă",
        "Lămpi cu petrol",
        "Ceasuri cu cuc",
        "Aparate radio vechi",
        "Monede și bancnote",
        "Fiere de călcat și samovare"
      ],
      "invitatie": "Casa bunicii e un muzeu întreg. Alege un obiect — lampa, ceasul, radio-ul — și spune-ne povestea lui."
    },
    {
      "id": "sala-marturiilor",
      "nume": "Sala Mărturiilor",
      "icon": "🕊️",
      "perete": "#4c2650",
      "lambriu": "#3a1f33",
      "descriere": "Scrisori de pe front, daruri și povești trăite.",
      "obiecte_tipice": [
        "Scrisori de pe front",
        "Fotografii de război",
        "Medalii și insigne",
        "Jucării vechi",
        "Trofee și mingi",
        "Daruri de la absolvenți"
      ],
      "invitatie": "O scrisoare, o medalie, un trofeu — mărturiile trăite merită să fie auzite. Trimite-ne povestea ta."
    }
  ],
  "obiecte": []
};
