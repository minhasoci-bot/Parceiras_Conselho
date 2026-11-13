# Mutirão da Mentoria

O painel acompanha a meta coletiva de R$ 22.455 até 30 de novembro de 2026 para garantir a entrada das 15 pessoas na mentoria.

## Abrir localmente

No terminal, dentro desta pasta, execute:

```powershell
node build.mjs
node preview.mjs
```

Abra [o painel local](http://127.0.0.1:4188/) e escolha **Entrar**. Use sua conta autorizada no Supabase. Para entrar na prévia local por e-mail, cole o endereço de um link novo no formulário ou digite o código recebido. Na versão da Vercel, o link também abre o painel diretamente. Contas com senha podem usá-la em ambas as versões.

## Acesso da equipe

1. Cadastre as contas da equipe em **Authentication → Users** no Supabase.
2. Autorize cada conta inserindo o seu ID em `public.mutirao_mentoria_members` no editor SQL. Substitua o exemplo abaixo pelo ID da conta.

   ```sql
   insert into public.mutirao_mentoria_members (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict do nothing;
   ```

As contas autorizadas acessam o mesmo caixa coletivo. O registro de vendas contém os valores, as datas e o status de cada transação.

## Hospedar na Vercel

1. Importe o repositório com o **Root Directory** padrão. O arquivo `vercel.json` configura o build e o diretório de saída.
2. Em **Settings → Environment Variables**, adicione `SUPABASE_URL` com a URL do projeto e `SUPABASE_PUBLISHABLE_KEY` com a chave `sb_publishable_…`. Selecione **Production** e, se for usar as prévias com esse mesmo banco, **Preview**.
3. Faça o deploy. Se adicionar ou alterar as variáveis depois, gere um novo deploy.
4. No Supabase, defina o endereço da Vercel em **Authentication → URL Configuration → Site URL** para que os links de acesso retornem ao painel publicado.

## Configuração

O arquivo local `supabase.config.json` contém a URL do projeto e sua chave **publicável**. O build inclui essas duas informações no HTML. Para usar o painel com outro projeto, configure o arquivo abaixo, aplique [o SQL inicial](supabase/setup.sql) uma vez nesse projeto e rode `node build.mjs`.

```json
{
  "url": "https://seu-projeto.supabase.co",
  "key": "sb_publishable_..."
}
```

As variáveis de ambiente têm prioridade sobre esse arquivo. Sem configuração, o build local salva os registros no navegador. Na Vercel, as duas variáveis são obrigatórias.
