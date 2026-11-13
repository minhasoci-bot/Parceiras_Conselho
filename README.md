# Mutirão da Mentoria

O painel acompanha a meta coletiva do grupo até 30 de novembro de 2026 para garantir a entrada dos participantes confirmados na mentoria:
- **R$ 1.497,00** por usuário registrado para **6 meses de curso**.
- **R$ 2.997,00** por usuário registrado para **1 ano de curso**.
A meta e o ritmo diário são calculados dinamicamente conforme os participantes entram e escolhem sua modalidade.

## Abrir localmente

No terminal, dentro desta pasta, execute:

```powershell
node build.mjs
node preview.mjs
```

Abra o painel local: [http://127.0.0.1:4188/](http://127.0.0.1:4188/)

## Fluxo de Login e Aprovação de Acesso

O sistema possui cadastro e login com e-mail e senha integrados ao Supabase, com aprovação direta pelo painel:

1. **Cadastro, Login e Recuperação de Senha**:
   - Qualquer pessoa do grupo clica em **Entrar** no topo da página.
   - Se ainda não tiver conta, clica em **Criar conta**, insere seu e-mail e define uma senha. O painel envia a solicitação ao administrador.
   - **Esqueci minha senha** depende do serviço de e-mail configurado no Supabase. Sem SMTP próprio, participantes de fora da equipe do projeto devem falar com o administrador.
   - Ao fazer login, o perfil do usuário fica visível no topo (avatar, e-mail, papel de acesso e botão de logout), além de destacar seu nome com a etiqueta **Você** na lista da equipe.
   - Se a conta ainda não foi aprovada, o sistema envia automaticamente a solicitação e exibe a mensagem **"Aguardando aprovação do administrador"**.
   - A tela do usuário verifica periodicamente e desbloqueia em tempo real assim que for aprovada.

2. **Aprovação pelo Administrador**:
   - O administrador faz login com sua conta autorizada.
   - No card **Equipe do mutirão**, o botão **Solicitações** mostra o contador de acessos pendentes.
   - Na página **Equipe**, disponível também no menu lateral, o administrador pode:
     - Conferir por um canal conhecido que a solicitação é da pessoa esperada e clicar em **Aprovar**. O usuário entra imediatamente como participante.
     - **Recusar** uma solicitação pendente.
     - **Ver e remover** participantes aprovados.
     - **Atribuir cargos** aos participantes sem alterar suas permissões de acesso.

---

## Configuração do Banco de Dados (Supabase)

### 1. Aplicar o SQL

Em um banco novo, execute [supabase/setup.sql](supabase/setup.sql), [a migração de cargos](supabase/migrations/20261113185556_member_positions.sql), [a migração do resumo público](supabase/migrations/20261113190131_public_dashboard_summary.sql), [a migração dos links de cenário](supabase/migrations/20261113200000_public_scenario.sql) e [a migração da lista pública de cenários](supabase/migrations/20261113210000_public_scenario_list.sql), nessa ordem, no **SQL Editor**. Em um banco já configurado, aplique as migrações que faltarem.

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

### 3. Configurar os e-mails

Em **Authentication → Sign In / Providers**, deixe **Allow new users to sign up** ligado e **Confirm email** desligado para usar aprovação manual sem confirmação por e-mail. O administrador deve conferir quem solicitou acesso antes de aprovar.

Em **URL Configuration**, informe a URL do painel publicado como **Site URL**. Para enviar redefinições de senha aos participantes, configure [SMTP próprio](https://supabase.com/docs/guides/auth/auth-smtp) em **Authentication → Emails → SMTP Settings**.

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
