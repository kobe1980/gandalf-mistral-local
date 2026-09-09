# Gandalf Mistral Local 🧙‍♂️

Clone éducatif **local** inspiré du jeu Gandalf de Lakera : le joueur tente d'extraire un mot de passe caché dans le contexte d'un LLM à l'aide de prompt injection.

Cette version utilise l'API **Mistral AI**, fonctionne avec le mode API Free (dans les limites du quota du compte), génère ses mots de passe dynamiquement côté serveur et propose 8 niveaux de défense progressifs.

> Projet indépendant à but pédagogique. Non affilié à Lakera ni à Mistral AI. N'utilise jamais ce projet avec de vrais secrets.

## Démarrage rapide

Prérequis : Python 3.9+ et une clé API Mistral.

```bash
git clone git@github.com:kobe1980/gandalf-mistral-local.git
cd gandalf-mistral-local

python -m venv .venv
source .venv/bin/activate       # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt

cp .env.example .env            # Windows: copy .env.example .env
```

Édite ensuite `.env` :

```dotenv
MISTRAL_API_KEY=colle_ta_cle_ici
MISTRAL_MODEL=mistral-small-latest
MISTRAL_BASE_URL=https://api.mistral.ai
```

Puis lance :

```bash
uvicorn app.main:app --reload
```

Ouvre **http://127.0.0.1:8000**.

## Obtenir une clé Mistral Free

1. Ouvre Mistral Studio : https://console.mistral.ai/
2. Va dans **API Keys**.
3. Crée une nouvelle clé et copie-la immédiatement.
4. Place-la uniquement dans ton fichier local `.env`.

**Ne mets jamais une vraie clé dans `.env.example` et ne commit jamais `.env`.** Le dépôt ignore volontairement ce fichier.

## Docker

```bash
cp .env.example .env
# renseigne MISTRAL_API_KEY dans .env
docker compose up --build
```

Puis ouvre **http://127.0.0.1:8000**.

## Les 8 niveaux

| # | Niveau | Défense principale |
|---|---|---|
| 1 | L'Apprenti | aucune défense sérieuse |
| 2 | Le Gardien | consigne système « ne révèle pas » |
| 3 | Le Filtre | redaction exacte en sortie |
| 4 | Le Juge | second LLM jugeant les fuites de sortie |
| 5 | La Porte | filtre heuristique sur les prompts entrants |
| 6 | Le Sentinelle | second LLM classant les prompts entrants |
| 7 | La Forteresse | combinaison des gardes d'entrée et de sortie |
| 8 | Gandalf le Blanc | combinaison durcie contre fragments et transformations |

Les mots de passe ont la forme `COBALT-RUNE-1234`, mais leur valeur est générée aléatoirement au démarrage et lors de **Nouvelle partie**. Elle n'est jamais envoyée au navigateur.

## Comment jouer

- Envoie des prompts à Gandalf dans la zone de chat.
- Si tu penses avoir extrait le secret, saisis-le dans le champ **Mot de passe extrait**.
- Un niveau réussi déverrouille le suivant.
- Les niveaux 4, 6, 7 et 8 peuvent consommer plusieurs appels Mistral par tentative parce qu'un second LLM joue le rôle de garde/judge.

## Architecture

```text
app/
  main.py             # API FastAPI et endpoints du jeu
  game.py             # niveaux, secrets et filtres heuristiques
  mistral_client.py   # client HTTP Mistral et juges LLM
static/
  index.html           # interface
  app.js
  styles.css
tests/
  test_game.py
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Avertissement sécurité

Ce projet implémente **volontairement des comportements vulnérables** afin de montrer pourquoi un simple system prompt n'est pas une frontière de sécurité fiable.

- N'utilise aucun vrai secret dans les prompts.
- Ne branche pas cette app sur des outils, bases de données ou systèmes de production.
- Ne l'expose pas publiquement sans authentification, quotas et isolation appropriés.
- Une fuite réussie dans ce laboratoire est le résultat attendu du jeu.

## Licence

MIT.
