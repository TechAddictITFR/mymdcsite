# Workflow : vidéo → landing page 3D pilotée au défilement

## Objectif
Transformer une courte vidéo en landing page professionnelle :
- la vidéo avance au rythme du défilement ;
- elle est rendue en relief 3D (Three.js) ;
- les couleurs de la page sont tirées de la vidéo.

Référence : landing page « Calvin », construite à partir de `~/Downloads/videoplayback (3).mp4`, en novembre 2026.

## Entrées nécessaires
- **Chemin de la vidéo** (MP4, MOV…), idéalement de 5 à 30 s.
- **Produit** : nom, promesse, cible. Sinon, en proposer un dont le récit colle à la vidéo et le faire valider avant de coder.
- **Ton** : par défaut professionnel, sobre, lisible.
- **Éléments de marque** : vérifier `brand_assets/` avant de concevoir.

## Outils
| Étape | Outil |
|---|---|
| Extraction des effets | `tools/extract_video_effects.sh <vidéo> [fps=15] [sortie=frames]` |
| Conversion RGB brut → JSON | `tools/build_sky_json.py` (appelé par le script ci-dessus) |
| Serveur local | `npm run serve` → http://localhost:3000 |
| Captures | `node screenshot.mjs <url> [libellé] [largeur] [hauteur] [défilement%]` |
| Référence technique | skill `.claude/skills/video-to-website/SKILL.md` |
| Direction artistique | skill `frontend-design` (à charger avant tout code) |

## Étapes
1. **Analyser la vidéo** avec `ffprobe` : résolution, durée, images/s.
   - Lancer l'extraction, puis regarder `.tmp/contact.png` (planche de 16 images) pour comprendre le récit et la palette.
   - Les couleurs dominantes du ciel et du sujet peuvent différer : regarder les deux pistes.
2. **Extraction** : `tools/extract_video_effects.sh`. Elle produit :
   - `frames/frame_NNNN.jpg` : images couleur ;
   - `frames/depth_NNNN.jpg` : cartes de relief ;
   - `frames/sky.json` : couleur du haut de l'image (ciel), image par image ;
   - `frames/core.json` : couleur du centre de l'image (sujet), image par image, avec saturation renforcée.
3. **Concevoir avant de coder** :
   - palette de 5 à 7 couleurs relevées sur les images ;
   - deux polices nettement distinctes ;
   - un seul élément marquant ;
   - un récit en sections calé sur les phases de la vidéo.

   Faire valider le produit et le nom par l'utilisateur.
4. **Construire** `index.html`, `css/style.css` et `js/app.js` sur le modèle de Calvin :
   - le haut de page (accueil) occupe tout l'écran ; la scène 3D apparaît ensuite par un cercle qui s'agrandit ;
   - `#scroll-container` : 850vh sur ordinateur, 600vh sur mobile ;
   - sections positionnées par `--mid` ;
   - bloc final `data-persist="true"`, placé à `--mid: 1`.
5. **Vérifier** :
   - captures à plusieurs positions de défilement, en 1440 × 900 et en 390 × 844 ;
   - au moins 2 tours de corrections ;
   - lisibilité, contraste, apparition de chaque bloc, appel à l'action visible en fin de page, aucune erreur console.

## Réglages qui fonctionnent
- **`FRAME_SPEED = 2.0`** : la vidéo se termine vers 50 % du défilement.
- **Vidéo verticale** :
  - sur ordinateur, la surface 3D occupe 80 % de la hauteur, au centre, et les textes vont dans des colonnes latérales `--zone: min(28vw, 27rem)` ;
  - sur mobile, la vidéo remplit l'écran et le texte se place dans un cadre sombre semi-opaque.
- **Relief 3D**, déplacement = `(profondeur × 0,6 + masque central × 0,4) × amplitude` :
  - amplitude de 0,32 à 0,54 pendant la fusion ;
  - rotation de départ de 0,62 rad en Y et de -0,2 rad en X ;
  - en dessous, l'effet 3D passe inaperçu.
- **Bords de la surface** fondus sur 7 à 8 % : au-delà, la perspective disparaît.
- **Accent** = couleur du sujet éclaircie de 40 % vers le blanc, pour rester lisible sur fond sombre.

## Pièges rencontrés et solutions
- **Le FFmpeg Homebrew local n'a pas `libwebp`** : la sortie se fait en JPEG (`-q:v 3`), suffisant pour une source en 360p.
- **Relief inversé** : en luminance brute, un sujet sombre sur ciel clair recule. Le script inverse donc la carte (`negate`), avec un contraste de 1,15 et un flou `sigma=9`. Un contraste plus fort fait des trous dans les reflets.
  - Pour une vidéo où le sujet est plus clair que le fond, retirer `negate`.
- **Animations GSAP bloquées sur les boutons** : la transition CSS de `transform`/`opacity` sur `.btn` laisse l'animation bloquée à son état de départ.
  - Toujours animer un conteneur (`.cta-row`), jamais l'élément qui porte la transition.
- **Mobile** : le cadre sombre des sections apparaissait vide avant son texte. Il est lié à `.is-active` (`opacity`).
- **Captures d'une scène fixe** : la capture pleine page ne montre pas les scènes. Utiliser l'argument `défilement%`, qui fait défiler progressivement puis capture l'écran visible.
  - Attention : ce % porte sur toute la page, accueil compris, et non sur `#scroll-container`.
- **WebGL dans Chrome sans affichage** : `screenshot.mjs` lance Chrome avec `--use-angle=swiftshader`.

## Résultat attendu
Un site statique, sans outil de compilation, servi en local :
- `index.html` ;
- `css/` ;
- `js/` ;
- `frames/`, environ 10 Mo pour 225 images couleur et relief.
