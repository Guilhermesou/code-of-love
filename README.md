# Código do Amor

Primeira versão local do criador e da surpresa, desenvolvida a partir dos protótipos do usuário. Os cinco arquivos originais ficam preservados em `references/` e não são servidos pela aplicação.

## Executar

Com Node.js 22 ou superior, execute `npm run dev` e abra http://127.0.0.1:4173. Não há dependências para instalar.

## O que funciona

- Criador em seis etapas com prévia conectada.
- Ocasião independente da fase atual do relacionamento; datas de encontro, namoro e casamento separadas.
- Fotos com redução de resolução, lembranças, áudio, vídeo, lugares com mapa e cartas seladas.
- Salvamento automático do rascunho em IndexedDB neste navegador.
- Backup e restauração do rascunho em JSON.
- Exportação de uma surpresa HTML independente, contendo as mídias enviadas.
- Abertura por coração, retorno direto à história, encerramento personalizado e reprodução exclusiva entre música, voz e vídeo.

## Nuvem (opcional)

Sem configuração, o app continua 100% local, como descrito acima. Para habilitar login, backup na nuvem e um link compartilhável:

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No SQL Editor do painel, rode o conteúdo de `supabase/schema.sql` (cria a tabela `surprises`, as políticas de RLS e o bucket de mídia).
3. Em Authentication → Providers, confirme que o provider de Email está ativo. Em Authentication → URL Configuration, adicione a URL onde o app roda (ex.: `http://127.0.0.1:4173` em desenvolvimento, e a URL do GitHub Pages em produção) como Site URL/Redirect URL — é para onde o link mágico de login redireciona de volta.
4. Em Project Settings → API, copie a Project URL e a chave `anon public`, e preencha `public/supabase-config.js` com esses valores.

A chave `anon` é feita para ser pública — quem acessa o site consegue vê-la, e a segurança fica por conta das políticas de RLS do banco, não do sigilo da chave. Nunca coloque a `service_role key` em código que roda no navegador.

Com isso configurado, a etapa "Entregar" ganha as opções de salvar o rascunho na nuvem e gerar um link para compartilhar (`seusite/?s=algum-slug`).

### Publicar no GitHub Pages

Como o app é só arquivos estáticos, basta apontar o Pages para a pasta `public/` (ou publicar seu conteúdo na raiz do branch usado pelo Pages). Não é preciso rodar `server.js` em produção — ele existe só para o ambiente de desenvolvimento local.

## Limites desta etapa

Sem a nuvem configurada, não há autenticação, servidor de dados, cobrança, publicação, link compartilhável ou QR code, e os dados permanecem neste navegador até serem exportados. A resposta final é uma interação local; não é enviada ao criador. As cartas são expansíveis, sem bloqueio por data ou senha.

Mapas usam OpenStreetMap e exigem conexão. Fontes usam Google Fonts com alternativas locais. Mídias por URL precisam ser arquivos diretos acessíveis; links de páginas do Spotify ou YouTube não são suportados. Arquivos de áudio/vídeo têm limite de 40 MB por item; capacidade total depende do navegador. O HTML pode ficar grande com vídeos. Para fotos, use JPG, PNG ou WebP compatíveis com o navegador.

## Verificação

`npm run check` verifica sintaxe. `npm test` verifica datas, personalização do casal, requisitos de exportação e URLs de mídia.
