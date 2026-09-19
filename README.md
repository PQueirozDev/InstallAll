# InstallAll

Aplicação web full-stack para analisar e baixar mídia pública compatível do YouTube, Instagram, X/Twitter e Twitch Clips quando o usuário tiver direito ou permissão. O sistema não contorna DRM, paywalls, autenticação ou controles de acesso.

## Visão geral

O frontend Next.js oferece preview, escolha de MP4/MP3, progresso, tema claro/escuro e histórico exclusivamente local. A API Express valida a URL novamente, resolve DNS para bloquear SSRF, delega a extração a um provider, cria um job temporário e entrega o arquivo por streaming. Arquivos são removidos após a resposta ou por timeout.

```text
Navegador (Next.js)
  ├─ POST /api/analyze ──> validação ──> provider ──> metadata
  └─ POST /api/downloads -> job -> yt-dlp -> FFmpeg (se necessário)
                              └─ GET /file -> stream -> limpeza
```

## Tecnologias

- Next.js 16, React 19 e TypeScript
- CSS responsivo sem runtime de UI
- Node.js 24, Express 5 e Zod
- yt-dlp (binário externo mantido ativamente) como mecanismo de extração pública
- FFmpeg para merge/remux e conversão MP3
- Vitest e Supertest
- Docker multi-stage e Docker Compose

O yt-dlp é deliberadamente executado com `spawn`, `shell: false` e argumentos separados. A lista oficial de sites inclui os extratores usados aqui, mas sites externos mudam frequentemente e não há garantia permanente de compatibilidade.

## Estrutura

```text
apps/
  web/                 # interface Next.js
  api/
    src/providers/     # adapters por plataforma
    src/security/      # URL, DNS e SSRF
    src/jobs.ts        # fila em memória, temporários e streaming
packages/shared/       # contratos TypeScript compartilhados
Dockerfile
docker-compose.yml
```

## Requisitos

- Node.js 22+ (24 recomendado) e npm 10+
- FFmpeg disponível no `PATH`
- yt-dlp recente disponível no `PATH`

### Instalar FFmpeg e yt-dlp

Windows (Winget):

```powershell
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
```

macOS:

```bash
brew install ffmpeg yt-dlp
```

Ubuntu/Debian (prefira o binário/repositório oficial atualizado do yt-dlp):

```bash
sudo apt install ffmpeg python3-pip
python3 -m pip install -U --pre "yt-dlp[default]"
```

Confirme com `ffmpeg -version` e `yt-dlp --version`.

## Instalação e desenvolvimento

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:3000`; a API fica em `http://localhost:4000`. Em PowerShell, use `Copy-Item .env.example .env`.

## Variáveis de ambiente

| Variável | Padrão | Função |
|---|---:|---|
| `PORT` | `4000` | Porta da API |
| `WEB_ORIGIN` | `http://localhost:3000` | Origem exata permitida no CORS |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | URL pública da API, embutida no build web |
| `YTDLP_PATH` | `yt-dlp` | Caminho do executável yt-dlp |
| `FFMPEG_PATH` | `ffmpeg` | Caminho do FFmpeg (documental; yt-dlp usa PATH) |
| `TEMP_DIR` | `./tmp` | Diretório isolado de jobs |
| `MAX_MEDIA_DURATION_SECONDS` | `7200` | Duração máxima aceita |
| `MAX_OUTPUT_BYTES` | `2147483648` | Tamanho máximo solicitado ao extrator |
| `JOB_TTL_MS` | `3600000` | Expiração de arquivos e jobs |
| `TRUST_PROXY` | `false` | Ative somente atrás de um proxy confiável |

Depois de mudar `NEXT_PUBLIC_API_URL`, refaça o build do frontend.

## Qualidade, testes e build

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm start -w @installall/api
npm start -w @installall/web
```

Os testes cobrem detecção de plataformas, rejeição de esquemas/hosts perigosos e sanitização de nomes. Para integração real, instale yt-dlp e use somente uma URL pública cuja mídia possa ser legitimamente baixada.

## Docker e deploy

```bash
docker compose up --build
```

Em produção, publique web e API em HTTPS, configure `WEB_ORIGIN`, compile o web com a URL pública da API, mantenha o diretório temporário em volume efêmero e limite CPU, memória e disco. Se houver reverse proxy, configure `TRUST_PROXY=true` apenas quando ele remover cabeçalhos forjados. Para múltiplas réplicas, substitua o mapa de jobs em memória por Redis/uma fila e use armazenamento temporário compartilhado ou roteamento aderente.

## Segurança e privacidade

- allowlist rígida de protocolo HTTPS e host por plataforma;
- validação de DNS e bloqueio de IPv4/IPv6 privado, loopback, link-local e CGNAT;
- validação duplicada no backend, corpo JSON limitado a 8 KB e URL a 2 KB;
- 10 análises/minuto/IP, 12 solicitações de download/minuto e 3 jobs simultâneos/IP;
- sem shell, sem URL concatenada a comando e sem caminhos vindos do usuário;
- nomes sanitizados e diretórios definidos por UUID;
- Helmet, CORS restrito e erros públicos sem stack trace;
- arquivos não são carregados inteiros na RAM;
- remoção depois da entrega e expiração automática em 1 hora;
- histórico e preferência de tema ficam apenas no `localStorage`.

O bloqueio DNS reduz SSRF, mas produção de alta segurança também deve impor egress allowlisting no firewall/container. Atualize yt-dlp regularmente, pois os sites suportados mudam. Não configure cookies, credenciais ou sessões privadas: este projeto destina-se apenas a conteúdo público.

## Providers

Cada provider implementa:

```ts
interface Provider {
  platform: Platform;
  getInfo(url: string): Promise<MediaInfo>;
  buildDownloadArgs(url: string, format: MediaFormat, output: string): string[];
}
```

Para adicionar uma plataforma:

1. acrescente o identificador em `packages/shared/src/index.ts`;
2. adicione hosts exatos em `apps/api/src/security/url.ts`;
3. crie `apps/api/src/providers/nova-plataforma.ts`;
4. registre o adapter em `providers/index.ts`;
5. mapeie nome/visual no frontend;
6. adicione testes de URLs válidas e URLs parecidas maliciosas;
7. documente restrições legais e técnicas específicas.

## Limitações

- Compatibilidade depende das páginas públicas e do yt-dlp; alterações externas podem quebrar temporariamente um provider.
- Instagram e X podem restringir conteúdo público por região ou exigir sessão; o InstallAll não tenta contornar isso.
- O foco do Twitch é Clips, embora o host seja reconhecido pelo detector.
- Estimativas de tamanho só aparecem quando o extrator fornece essa informação.
- Jobs são locais e em memória; a configuração padrão é indicada para uma única instância.
- O progresso de pós-processamento nem sempre é granular, então a interface mostra fases além do percentual de download.

## Uso responsável

O usuário é responsável por direitos autorais, termos da plataforma e permissões aplicáveis. Baixe apenas mídia própria, licenciada ou cuja autorização permita o download.
