# Código do Amor

Criador de surpresas pessoais com editor em sete etapas, prévia e exportação HTML. Os protótipos originais ficam preservados em `references/` e não são servidos pela aplicação.

## Executar e verificar

Com Node.js 22.13 ou superior:

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:4173. A aplicação não exige dependências em produção; `fake-indexeddb` e `jsdom` são usados somente nos testes.

```sh
npm run check
npm test
```

O deploy do GitHub Pages executa as verificações antes de publicar `public/`. `server.js` serve apenas para desenvolvimento.

## Recursos

- Criador em sete etapas com prévia, datas independentes e revisão antes da entrega.
- Fotos com redução de resolução, lembranças, áudio, vídeo, mapas e cartas expansíveis.
- Abertura por coração, álbum, linha do tempo e encerramento personalizado.
- Música por arquivo, player Spotify e player YouTube. A exclusividade de reprodução cobre as mídias nativas e o carregamento do Spotify; o iframe YouTube tem controles próprios.
- Salvamento automático no navegador, agrupando alterações e armazenando os arquivos como Blobs separados do texto no IndexedDB.
- Backup/restauração JSON e exportação HTML com os arquivos enviados incorporados.
- Nuvem opcional: login por e-mail, rascunho privado, versão publicada independente, copiar link e desativar link.

O botão de resposta final é uma interação local; não envia uma resposta ao criador. As cartas não têm bloqueio por data ou senha. As brincadeiras são opcionais e ficam antes da declaração na experiência.

## Brincadeiras

A etapa **Brincadeiras** permite ativar cada interação separadamente e experimentar uma prévia direta, sem passar pela abertura:

- **Quiz da nossa história:** de 1 a 5 perguntas, duas alternativas obrigatórias e uma terceira opcional, resposta certa e lembrança revelada. Qualquer resposta libera a lembrança; não há pontuação ou punição.
- **Memória com nossas fotos:** de 2 a 6 pares, usando as primeiras fotos diferentes da capa, lembranças e lugares. Pares incorretos ficam visíveis até a pessoa escolher “Virar novamente”, sem cronômetro. Há mensagem final personalizada e opção de recomeçar.
- **Nosso próximo encontro:** de 2 a 3 convites com mensagem revelada ao escolher. A escolha pode ser alterada e copiada; não é enviada automaticamente ao criador. Se a área de transferência não estiver disponível, o texto aparece para copiar manualmente.

Todos os jogos usam botões acessíveis por teclado, mensagens de estado e opção de pular/retomar. O encerramento nunca depende de ganhar ou terminar uma brincadeira. O progresso dura apenas enquanto a experiência permanece aberta; recarregar começa novamente.

Jogos ativados e incompletos aparecem na revisão e precisam ser completados ou desativados antes de publicar/exportar. Desativar mantém a configuração para depois. Rascunhos e backups antigos recebem todos os jogos desativados. A memória reutiliza as mídias já existentes, sem duplicar uploads.

Os jogos funcionam na prévia, no link e no HTML exportado. Fotos incorporadas funcionam sem internet; fotos por URL continuam dependendo de conexão. Para links de nuvem, publique novamente a função `shared-surprise` com o código atualizado, pois ela também normaliza os novos campos. Não é necessária outra alteração SQL além da migração de privacidade descrita abaixo.

## Nuvem: instalação

1. Crie um projeto Supabase e execute `supabase/schema.sql` no SQL Editor. O script também serve como migração da versão anterior e pode ser reexecutado.
2. Publique a Edge Function `shared-surprise`. Com a CLI Supabase instalada e autenticada:

   ```sh
   supabase functions deploy shared-surprise --project-ref SEU_PROJECT_REF
   ```

   `supabase/config.toml` desativa a exigência de JWT **somente nessa função**, pois o destinatário não precisa criar uma conta. A função exige o token completo do link, busca apenas uma versão publicada e assina apenas arquivos pertencentes àquela surpresa. Ela não lista rascunhos ou surpresas.
3. A função usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente de execução do Supabase. Nunca copie a chave de serviço para `public/`, backups ou código do navegador.
4. Ative o provider de Email em Authentication e adicione a URL do app às URLs de redirecionamento permitidas.
5. Preencha `public/supabase-config.js` com a Project URL e a chave pública `anon`. Essa chave é pública por projeto; a autorização depende das políticas RLS e da função.

Sem configuração, o editor e a exportação continuam disponíveis localmente. Com frontend configurado e backend antigo, as ações de nuvem precisam da migração acima: não existe fallback para publicação insegura.

### Publicar pelo painel, sem CLI

1. Se a migração de privacidade ainda não foi aplicada, abra **SQL Editor → New query**, cole `supabase/schema.sql` e execute.
2. Abra **Edge Functions → Deploy a new function → Via Editor**. Use o nome exato `shared-surprise`. Se ela já existe, abra seu editor de código.
3. Substitua o conteúdo de `index.ts` pelo arquivo completo `supabase/dashboard/shared-surprise.js` e publique em **Deploy function** ou **Deploy updates**. Esse arquivo reúne as dependências locais; copiar apenas o `index.ts` original não basta.
4. Nos detalhes dessa função, desative **Verify JWT** (o painel também pode chamar de **Verify JWT with legacy secret**) e salve. Isso permite que destinatários abram o link sem login; a função continua exigindo o token do link e uma surpresa publicada.
5. Em **Test**, envie um POST com JSON `{"slug":"teste-inexistente"}`. Com banco e função configurados, um token inexistente retorna HTTP 200 com `{"draft":null}`. Depois teste um link real publicado em janela anônima, incluindo fotos e jogos.

As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são lidas do ambiente da função; não coloque valores de chaves no arquivo. Após mudanças nos módulos da função, regenere a cópia do painel com `node scripts/build-dashboard-function.mjs` antes de republicar. O arquivo gerado fica fora de `public/`.

Referência: [publicação pelo Dashboard do Supabase](https://supabase.com/docs/guides/functions/quickstart-dashboard).

## Atualizar um projeto existente

Faça backup do banco e dos arquivos antes da migração. Coordene SQL, função e frontend na mesma janela de atualização: a remoção da leitura anônima torna o frontend antigo incompatível com a nova política.

- O SQL copia cada surpresa já pública para `published_draft`, preservando seu slug e conteúdo no momento da migração.
- A tabela passa a ser legível somente pelo proprietário autenticado. Destinatários acessam a função pelo token completo, sem permissão de listar a tabela.
- Novos arquivos são enviados ao bucket **privado** `surprise-media`. Seus caminhos contêm um hash do conteúdo e não podem ser sobrescritos; uma edição de rascunho não substitui arquivos da versão entregue.
- O bucket público legado `media` **não é apagado nem tornado privado automaticamente**, para preservar arquivos HTML e links antigos. Suas URLs continuam públicas. Para migrar uma mídia antiga, envie novamente o arquivo no editor e publique a atualização. Revise referências antes de remover os arquivos legados ou tornar esse bucket privado.
- Links antigos preservam seus tokens existentes. Para obter um novo token mais longo, desative o link e publique novamente; o endereço anterior deixa de funcionar.
- O IndexedDB migra automaticamente da versão 1 para 2. Textos e arquivos são gravados na mesma transação, e uma falha preserva o último rascunho salvo. Backups JSON v1 continuam compatíveis.

A migração SQL e a função precisam ser aplicadas no projeto remoto para ativar a mudança. Alterar arquivos locais não altera o Supabase.

## Rascunho, publicação e privacidade

- **Salvar rascunho na nuvem:** atualiza somente a cópia privada, mesmo se houver link ativo.
- **Publicar / Publicar atualização:** valida os mesmos requisitos do HTML e substitui explicitamente a versão entregue, mantendo o link ativo.
- **Desativar link:** impede novas aberturas pelo endereço antigo e troca o token. Publicar novamente gera um endereço diferente.
- A mídia privada é servida por URLs assinadas com validade de uma hora. Desativar não revoga URLs já emitidas imediatamente, nem recupera cópias baixadas. Reabra a surpresa se uma mídia expirar durante uma leitura longa.
- Quem possui um link ativo pode acessar e copiar a versão publicada. Não é criptografia de ponta a ponta.
- Ao restaurar da nuvem, os arquivos privados são baixados e incorporados ao rascunho local. Assim, backups e HTML não dependem de URLs assinadas que irão expirar.
- URLs externas fornecidas pelo criador e arquivos do bucket legado seguem as regras do respectivo serviço.
- Arquivos antigos na nuvem não são removidos automaticamente nesta versão; isso evita apagar mídias ainda usadas em publicações. Limpeza e cotas de conta são trabalho futuro.

## Organização

- `public/model.js`: schema v1, normalização e validação de entrega.
- `public/game-model.js`, `public/games-editor.js` e `public/games.js`: configuração, edição e experiência dos jogos; o runtime também é incorporado ao HTML exportado.
- `public/store.js` e `public/lib/autosave.js`: IndexedDB transacional e fila de salvamento.
- `public/lib/media.js`: empacotamento, hashes e referências de mídia.
- `public/lib/cloud-repository.js`: persistência privada, publicação e revogação, com cliente injetável para testes.
- `public/lib/cloud.js`: autenticação e conexão com Supabase.
- `supabase/functions/shared-surprise/`: leitura por token e assinatura de mídia no servidor.
- `tests/`: testes de regras, exportação, migração local, falhas de transação, publicação, revogação e isolamento de mídias na função, configuração dos jogos, acessibilidade dos controles e execução real do HTML exportado em DOM simulado.

Os testes do repositório de nuvem e da função usam um adaptador simulado: não comprovam as políticas RLS ou a implantação em uma conta real. Antes de disponibilizar a nova nuvem, confira com duas contas que uma não consegue ler/escrever registros ou arquivos da outra, que `anon` não consegue listar `surprises`, e que apenas o link ativo abre a versão publicada. Teste também a restauração e a abertura do HTML baixado.

## Limites

Mapas e players externos exigem conexão. Fontes usam Google Fonts com alternativas locais. Áudio/vídeo têm limite de 40 MB por arquivo; capacidade total depende do navegador e do projeto Supabase. HTML com vídeos pode ficar grande. Para fotos, use JPG, PNG ou WebP compatíveis com o navegador.
