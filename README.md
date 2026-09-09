# Gandalf Local 🧙‍♂️

Clone éducatif **100 % local** inspiré du jeu Gandalf de Lakera : le joueur tente d'extraire un mot de passe caché dans le contexte d'un LLM à l'aide de prompt injection.

Cette version utilise **Ollama** avec un modèle local, par défaut `qwen2.5:14b-instruct-q4_K_M`. Aucun compte cloud, aucune clé API réelle et aucun quota externe ne sont nécessaires.

> Projet indépendant à but pédagogique. Non affilié à Lakera, Mistral AI ou Ollama. N'utilise jamais ce projet avec de vrais secrets.

## Prérequis

- Linux / Ubuntu recommandé pour le `docker-compose.yml` fourni
- Docker + Docker Compose
- Ollama installé sur la machine hôte
- le modèle `qwen2.5:14b-instruct-q4_K_M`

Le modèle attendu est également documenté dans `ollama-models.txt`.

## 1. Installer / vérifier Ollama

Vérifie qu'Ollama fonctionne :

```bash
ollama list
```

Le modèle suivant doit être présent :

```text
qwen2.5:14b-instruct-q4_K_M
```

S'il n'est pas encore installé :

```bash
ollama pull qwen2.5:14b-instruct-q4_K_M
```

### Charger le modèle avant de lancer Gandalf

Dans le setup actuellement validé, le modèle doit être chargé dans Ollama au moins une première fois avant d'utiliser Gandalf.

Lance :

```bash
ollama run qwen2.5:14b-instruct-q4_K_M
```

Tu peux ensuite quitter l'invite interactive si nécessaire. Vérifie que le modèle est bien chargé avec :

```bash
ollama ps
```

Tu dois voir `qwen2.5:14b-instruct-q4_K_M` dans la liste des modèles actifs.

Cette étape est importante : `ollama list` ou `/v1/models` confirment qu'un modèle est **installé**, tandis que `ollama ps` permet de vérifier qu'il est effectivement **chargé**. Sur le setup testé, Gandalf n'a commencé à fonctionner correctement qu'après un `ollama run` explicite.

Teste ensuite l'API locale compatible OpenAI d'Ollama :

```bash
curl http://127.0.0.1:11434/v1/models
```

Tu dois obtenir une réponse contenant notamment :

```json
{
  "id": "qwen2.5:14b-instruct-q4_K_M"
}
```

## 2. Cloner le projet

```bash
git clone git@github.com:kobe1980/gandalf-mistral-local.git
cd gandalf-mistral-local
cp .env.example .env
```

## 3. Configurer `.env` pour Ollama

Utilise cette configuration :

```dotenv
MISTRAL_API_KEY=ollama
MISTRAL_MODEL=qwen2.5:14b-instruct-q4_K_M
MISTRAL_BASE_URL=http://127.0.0.1:11434
MISTRAL_MIN_INTERVAL_SECONDS=0
MISTRAL_MAX_RETRIES=0
```

### Pourquoi les variables s'appellent encore `MISTRAL_*` ?

Le client HTTP historique du projet s'appelle encore `MistralClient` et lit ces variables. Il parle cependant à une API de type OpenAI `/v1/chat/completions`, ce qu'Ollama expose également.

La valeur :

```dotenv
MISTRAL_API_KEY=ollama
```

est donc une **clé factice**. Ollama local n'en a pas besoin ; elle est uniquement renseignée parce que le code actuel considère le client comme configuré lorsqu'une valeur non vide est présente.

`MISTRAL_MIN_INTERVAL_SECONDS=0` et `MISTRAL_MAX_RETRIES=0` désactivent le pacing et les retries qui étaient nécessaires avec les quotas de l'API Mistral.

## 4. Lancer Gandalf avec Docker

Le `docker-compose.yml` utilise :

```yaml
network_mode: host
```

Cela permet au conteneur Gandalf d'accéder directement à l'Ollama de la machine hôte via :

```text
http://127.0.0.1:11434
```

Ollama n'a donc pas besoin d'être exposé sur le réseau local.

Avant de lancer Docker, vérifie une dernière fois que le modèle est chargé :

```bash
ollama ps
```

Puis lance l'application :

```bash
docker compose down
docker compose up --build
```

Puis ouvre :

```text
http://127.0.0.1:8000
```

## 5. Vérifier la connexion Gandalf → Ollama

Le nom de l'endpoint conserve encore la terminologie historique Mistral :

```bash
curl http://127.0.0.1:8000/api/mistral/probe
```

Une configuration correcte doit retourner quelque chose de proche de :

```json
{
  "ok": true,
  "model": "qwen2.5:14b-instruct-q4_K_M",
  "model_listed": true
}
```

Si `model_listed` vaut `false`, vérifie le nom exact retourné par :

```bash
curl http://127.0.0.1:11434/v1/models
```

## Lancer sans Docker

Il est aussi possible de faire tourner FastAPI directement sur la machine hôte :

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Avec le même `.env`, l'application joindra directement Ollama sur `127.0.0.1:11434`.

## Dépendances

`requirements.txt` contient uniquement les dépendances **Python** de l'application : FastAPI, HTTPX, python-dotenv et Uvicorn.

Ollama et les modèles Ollama ne sont pas des packages Python et ne doivent donc pas être ajoutés à `requirements.txt`.

Les modèles locaux requis sont documentés séparément dans :

```text
ollama-models.txt
```

Configuration actuelle :

```text
qwen2.5:14b-instruct-q4_K_M
```

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

Aux niveaux avancés, plusieurs inférences locales peuvent être exécutées pour une seule tentative :

- Gandalf génère sa réponse ;
- un second appel au même modèle peut classifier le prompt entrant ;
- un autre appel peut juger si la réponse divulgue le secret.

Avec Ollama, tous ces appels restent locaux.

## Comment jouer

- Envoie des prompts à Gandalf dans la zone de chat.
- Essaie différentes techniques de prompt injection.
- Si tu penses avoir extrait le secret, saisis-le dans **Mot de passe extrait**.
- Un niveau réussi déverrouille le suivant.

## Architecture

```text
app/
  main.py             # API FastAPI et endpoints du jeu
  game.py             # niveaux, secrets et filtres heuristiques
  mistral_client.py   # client HTTP compatible OpenAI, actuellement utilisé avec Ollama
static/
  index.html           # interface
  app.js
  styles.css
  levels/              # illustrations HD des 8 niveaux
ollama-models.txt      # modèle Ollama attendu
tests/
  test_game.py
  test_api.py
```

Endpoints utiles :

- `GET /api/config`
- `GET /api/health`
- `GET /api/mistral/probe`
- `POST /api/chat`
- `POST /api/guess`
- `POST /api/reset`

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Diagnostic rapide

### Ollama ne répond pas

```bash
curl http://127.0.0.1:11434/v1/models
```

Si cette commande échoue, le problème est côté Ollama avant d'être côté Gandalf.

### Le modèle est installé mais Gandalf ne fonctionne pas

Vérifie d'abord :

```bash
ollama ps
```

Si la liste est vide, charge explicitement le modèle :

```bash
ollama run qwen2.5:14b-instruct-q4_K_M
```

Puis revérifie :

```bash
ollama ps
```

C'est le comportement observé sur le setup de référence : le modèle était bien présent dans `ollama list` et `/v1/models`, mais Gandalf ne fonctionnait correctement qu'après son chargement explicite via `ollama run`.

### Gandalf ne voit pas le modèle

```bash
curl http://127.0.0.1:8000/api/mistral/probe
```

Puis compare le champ `model` avec le nom exact retourné par `/v1/models`.

### Le conteneur démarre mais ne joint pas Ollama

Le compose fourni repose sur `network_mode: host`, adapté au setup Linux local. Vérifie que :

- Ollama écoute bien sur `127.0.0.1:11434` ;
- le modèle apparaît dans `ollama ps` ;
- aucun autre service n'utilise le port `8000` ;
- le `.env` contient bien `MISTRAL_BASE_URL=http://127.0.0.1:11434`.

## Avertissement sécurité

Ce projet implémente **volontairement des comportements vulnérables** afin de montrer pourquoi un simple system prompt n'est pas une frontière de sécurité fiable.

- N'utilise aucun vrai secret dans les prompts.
- Ne branche pas cette app sur des outils, bases de données ou systèmes de production.
- Ne l'expose pas publiquement sans authentification, quotas et isolation appropriés.
- Une fuite réussie dans ce laboratoire est le résultat attendu du jeu.

## Licence

MIT.
