# PROJET.md — Drip'in

## Liens
- Repo : https://github.com/mr7snowmountain-wq/DRIP-in
- Live : https://drip-in.vercel.app

## Concept
App styliste virtuelle — photo d'une tenue → analyse IA → rapport de style complet + conseils personnalisés.

## Stack technique
- Frontend : Next.js (pages router)
- Déploiement : Vercel
- IA : API Anthropic (Claude Haiku) via proxy maison
- Auth / DB : aucune pour l'instant
- Paiement : aucun pour l'instant

## Architecture API
Fichier : `api/analyze.js`
- Proxy simple vers `https://api.anthropic.com/v1/messages`
- Passe le `req.body` directement à Anthropic
- Clé API via variable d'environnement `ANTHROPIC_API_KEY`
- CORS ouvert (*)

## Ce qui est fait
- [x] Page d'accueil
- [x] Upload photo + appel API Claude + réponse affichée

## Ce qui reste à faire
- [ ] Login / compte utilisateur (Supabase)
- [ ] Historique des analyses
- [ ] Paiement abonnement (Lemon Squeezy)
- [ ] Version mobile optimisée

## Comment démarrer une session avec Claude
Copiez-collez ce bloc en début de chaque nouvelle conversation :

> Je développe Drip'in — app styliste virtuelle Next.js + API Anthropic.
> Repo : github.com/mr7snowmountain-wq/DRIP-in
> Live : drip-in.vercel.app
> Stack : Next.js, pas de DB pour l'instant, proxy Anthropic dans api/analyze.js
> Tâche du jour : [décrivez ici ce que vous voulez faire]
