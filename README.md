# Mutirão da Mentoria

O painel acompanha a meta coletiva de R$ 22.455 até 30 de novembro de 2026 para garantir a entrada dos participantes confirmados na mentoria.

## Abrir localmente

No terminal, dentro desta pasta, execute:

```powershell
node build.mjs
node preview.mjs
```

Abra o painel local: [http://127.0.0.1:4188/](http://127.0.0.1:4188/)

## Fluxo de Login e Aprovação de Acesso

O sistema possui cadastro e login com e-mail e senha integrados ao Supabase, com aprovação direta pelo painel:

1. **Cadastro e Login do Usuário**:
   - Qualquer pessoa do grupo clica em **Entrar** no topo da página.
   - Se ainda não tiver conta, clica em **Criar conta**, insere seu e-mail e define uma senha.
   - Ao fazer login, se a conta ainda não foi aprovada, o sistema envia automaticamente a solicitação e exibe a mensagem **"Aguardando aprovação do administrador"**.
   - A tela do usuário verifica periodicamente e desbloqueia em tempo real assim que for aprovada.

2. **Aprovação pelo Administrador**:
   - O administrador faz login com sua conta autorizada.
   - No topo e no card **Equipe do mutirão**, surgirá o botão com o contador de solicitações pendentes (ex.: **Equipe (2)**).
   - Ao clicar, o administrador abre o modal de gerenciamento e pode:
     - **Aprovar** com 1 clique (o usuário entra imediatamente como participante).
     - **Recusar** uma solicitação pendente.
     - **Ver e remover** participantes aprovados na aba *Participantes aprovados*.

---

## Configuração do Banco de Dados (Supabase)

### 1. Aplicar o SQL

No seu projeto Supabase, acesse **SQL Editor** e execute o script [supabase/setup.sql](supabase/setup.sql) (ou a migração incremental [supabase/migrations/20261113165102_mutirao_access_approval.sql](supabase/migrations/20261113165102_mutirao_access_approval.sql)).

### 2. Definir o primeiro Administrador

Após criar a sua própria conta no painel (ou em **Authentication → Users** no Supabase), execute o bloco abaixo no **SQL Editor** substituindo pelo seu e-mail:

```sql
do $$
declare
  target_id uuid;
begin
  select id into target_id from auth.users where email = 'seu-email@exemplo.com';
  if target_id is not null then
    insert into public.mutirao_mentoria_members (user_id) values (target_id) on conflict do nothing;
    insert into public.mutirao_mentoria_admins (user_id) values (target_id) on conflict do nothing;
    raise notice 'Usuário % promovido a admin com sucesso!', target_id;
  else
    raise notice 'Usuário não encontrado. Crie a conta primeiro no painel com esse e-mail.';
  end if;
end $$;
```

Pronto! Ao entrar com essa conta, você terá privilégios de administrador para aprovar os demais membros diretamente pela interface web.

---

## Hospedar na Vercel

1. Importe o repositório com o **Root Directory** padrão. O arquivo `vercel.json` configura o build e o diretório de saída.
2. Em **Settings → Environment Variables**, adicione `SUPABASE_URL` com a URL do projeto e `SUPABASE_PUBLISHABLE_KEY` com a chave `sb_publishable_…`. Selecione **Production** e **Preview**.
3. Faça o deploy. Se adicionar ou alterar as variáveis depois, gere um novo deploy.

## Configuração local

O arquivo local `supabase.config.json` contém a URL do projeto e sua chave **publicável**:

```json
{
  "url": "https://seu-projeto.supabase.co",
  "key": "sb_publishable_..."
}
```

Rode `node build.mjs` sempre que alterar os arquivos para regenerar o `dist/index.html`.
