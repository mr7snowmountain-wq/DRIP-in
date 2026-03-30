# Drip'In — Guide de déploiement Vercel

## Structure
```
dripin/
├── api/
│   └── analyze.js          ← proxy sécurisé vers Anthropic
├── public/
│   ├── index.html          ← l'app complète
│   ├── manifest.json       ← PWA
│   └── images/             ← 22 photos en WebP (ultra-légères)
│       ├── minimal_1.webp
│       ├── street_1.webp
│       └── ...
└── vercel.json             ← config déploiement
```

## Déploiement en 5 min sur Vercel

### 1. Créer un compte Vercel (gratuit)
→ https://vercel.com → "Sign up" avec Google ou GitHub

### 2. Installer Vercel CLI
```bash
npm install -g vercel
```

### 3. Déployer
```bash
cd dripin
vercel
```
Réponds aux questions :
- Project name → `dripin`
- Framework → `Other`

### 4. Ajouter ta clé API Anthropic
Sur https://vercel.com → ton projet → Settings → Environment Variables
- Name: `ANTHROPIC_API_KEY`
- Value: ta clé `sk-ant-...` (depuis https://console.anthropic.com/settings/keys)
- Clique Save

### 5. Redéployer
```bash
vercel --prod
```

→ Ton app est live sur `https://dripin.vercel.app` 🎉

## Poids des fichiers
- index.html : ~60KB (vs 950KB avant les WebP !)
- 22 images WebP : 714KB total
- Total app : ~780KB (vs 2.4MB avant)
