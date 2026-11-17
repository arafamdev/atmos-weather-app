# Atmos — Relatório de finalização para portefólio

Data: 17 de novembro de 2026, Europe/Lisbon.

## Estado e fontes

O desenvolvimento funcional desta versão está encerrado. A aplicação está
publicada em [produção](https://atmos-weather-app-kohl.vercel.app), com o commit
`8bd7902805d7c91e52b5617ec360071a730f843a` integrado em main por Squash and merge
do [PR #9](https://github.com/arafamdev/atmos-weather-app/pull/9).

Este registo distingue inspeção do código e verificações executadas nesta etapa
da validação física comunicada pelo utilizador. A finalização documental é
submetida separadamente na branch `docs/finalize-atmos-portfolio`; o respetivo
PR deve ser revisto e integrado manualmente, sem alterar funcionalidades.

## Auditoria e sincronização Git

Estado inicial: working tree limpo em `fix/ios-city-selection`, commit
`33f2dde6f5b2e10391ec5378624f5bdff7fa63e4`. A main local estava em `b4f1351`.
Foi confirmado no GitHub que o PR #9 estava integrado no squash esperado.

Comandos executados para inspeção e sincronização:

```bash
git status --short --branch
git branch -vv
git remote -v
git log -5 --oneline
git worktree list
git fetch origin
git switch main
git pull --ff-only origin main
git diff --exit-code main fix/ios-city-selection
git diff --exit-code main origin/fix/ios-city-selection
git rev-parse HEAD origin/main 'main^{tree}' 'fix/ios-city-selection^{tree}'
git branch -d fix/ios-city-selection
git push origin --delete fix/ios-city-selection
git switch -c docs/finalize-atmos-portfolio
```

A main e origin/main ficaram no SHA completo indicado acima, sem divergência.
As duas comparações de conteúdo ficaram vazias. O hash da árvore completa era
`78a37f6fedb3dd9bf1ef1960a92470b0023f0157` tanto na main como na correção local.
Só depois desta verificação foram eliminadas a branch local e remota da correção.

O aviso de `git branch -d` sobre ausência de ancestralidade com HEAD é esperado
num squash. Não foi usada eliminação forçada. As outras branches foram
preservadas; não houve reset, rebase ou force push.

## Funcionalidades verificadas no código

- Pesquisa de cidades com debounce, seleção por teclado/ponteiro e regiões/países.
- Condições atuais e previsão dos quatro dias seguintes com dados Open-Meteo.
- Previsão horária por dia civil local, eventos Sunrise/Sunset e destaque NOW.
- Timezones IANA, timestamps Unix, transições DST e horas locais repetidas.
- Gráfico de probabilidade de precipitação com valores em texto.
- Temas Dark e Soft Light com preferência persistida e inicialização antes do render.
- Estados de loading, erro, Retry e atualização; cache e cancelamento por localização.
- Layout responsivo, semântica acessível, foco visível, Footer e favicon próprios.

Serviços, adaptadores, hooks e componentes têm responsabilidades separadas. Os
dados demo continuam identificados num módulo próprio, sem fallback silencioso
na interface de produção. Não existem backend, autenticação ou geolocalização.

## Incidente Safari iOS — PR #9

O problema reportado era específico do toque: a sugestão aparecia, mas a cidade
continuava Porto e o input não era limpo. Desktop funcionava.

O código anterior cancelava `pointerdown` nas opções, mas dependia de `click`
para selecionar. A lista também era desmontada imediatamente no blur do input.
Existe uma [regressão documentada do WebKit](https://github.com/WebKit/WebKit/commit/7ac1727cb827b51dc695c8d95b82ea74abc10d6b)
em que cancelar pointerdown suprime o click sintético. Este é um mecanismo
plausível, não uma captura comprovada da sequência no iPhone afetado.

A correção substituiu `onPointerDown(event.preventDefault())` por
`onMouseDown(event.preventDefault())`, preservando foco sem cancelar o início
do gesto de toque. Click continua a ser o único caminho de seleção por ponteiro;
não foram adicionadas seleções em touchend/pointerup nem dependências.

O utilizador confirmou o funcionamento no iPhone físico, primeiro no preview
conforme o registo do PR e depois em produção após o deployment automático.
Pesquisa e seleção atualizam a cidade e limpam o input. Esta validação é
atribuída ao utilizador; não foi repetida num iPhone pelo agente nesta etapa.
A versão exata de iOS/Safari e a sequência nativa de eventos não foram registadas.

## Validação de finalização

| Verificação executada | Resultado |
| --- | --- |
| `npm test` | 178 aprovados, 0 falhas, 0 ignorados |
| `npm run lint` | Aprovado |
| `npm run build` | Aprovado; saída estática em dist |
| `git diff --check` | Aprovado |

Ambiente local: Node.js 26.3.0 e npm 11.16.0. O CI usa Node.js 24 e `npm ci`.
Não foram instaladas dependências nesta finalização.

O runner é `node --test`, não Vitest. Os cinco testes DOM de pesquisa em
`tests/city-search.html` são uma suite separada, não incluída no número 178 nem
no CI. Foram executados com sucesso durante o PR #9; não foram repetidos nesta
etapa exclusivamente documental. Usam eventos sintéticos, não gestos Safari
nativos. As instruções e limites estão em [tests/README.md](../tests/README.md).

Não foram realizadas novas verificações visuais de todos os layouts nem testes
de leitor de ecrã nesta etapa. Não foram adicionadas screenshots: não existem
capturas versionadas no repositório e não foram fabricadas imagens de produto.

## Deploy e apresentação a recrutadores

Produção: [Atmos Weather App](https://atmos-weather-app-kohl.vercel.app).
Repositório: [arafamdev/atmos-weather-app](https://github.com/arafamdev/atmos-weather-app).

A integração GitHub → Vercel gera previews de PR e publica automaticamente
alterações integradas em main. O utilizador confirmou estado Ready após o PR #9.
Nesta finalização, o URL público respondeu HTTP 200 com HTML da aplicação e o
favicon respondeu HTTP 200 com MIME `image/svg+xml`. A consulta de deployments
pela API GitHub não devolveu registos para esse SHA; o estado Ready é atribuído
à confirmação do utilizador, não a uma nova inspeção da configuração Vercel.
Não foi executado deploy manual nem alterada a configuração da Vercel.
O workflow GitHub Actions valida testes, lint e build em PR e push para main;
CI e deployment são verificações distintas.

Apresentação sugerida para portefólio:

> Desenvolvi o Atmos, um dashboard meteorológico responsivo com React 19,
> Tailwind CSS v4 e TanStack Query. Integrei pesquisa global e previsões
> Open-Meteo, com cache por cidade, cancelamento de pedidos, temas persistentes
> e tratamento de timezones/DST. Acrescentei 178 testes automatizados Node,
> testes DOM de interação e um fluxo GitHub Actions/Vercel. Investiguei ainda
> uma falha de seleção por toque no Safari, corrigida e validada pelo utilizador
> num iPhone físico em produção.

O README em inglês apresenta demonstração, funcionalidades, stack, arquitetura,
setup, scripts reais, API, testes, acessibilidade, deploy, autoria e limitações.

A descrição pública do GitHub foi atualizada para:

> Responsive weather dashboard built with React 19, Tailwind CSS and TanStack
> Query, featuring Open-Meteo forecasts, city search and dark/light themes.

O campo website já apontava para o URL de produção correto e foi mantido.

## Pendências e decisões preservadas

1. LinkedIn é um destino genérico explicitamente temporário. Confirmar um URL
   pessoal ou decidir remover esse link numa alteração separada; não foi alterado.
2. Não existe ficheiro de licença. A escolha da licença cabe ao autor; não foi
   atribuída automaticamente uma licença MIT ou equivalente.
3. Testes DOM ainda não integram CI; cobertura física e de leitores de ecrã não é
   exaustiva. CI verde não representa certificação de acessibilidade.
4. Não há polling contínuo. Um separador aberto durante muito tempo pode ficar
   fora do intervalo de previsão em cache; os estados existentes tratam a ausência.
5. Dependência da disponibilidade da Open-Meteo e da ligação à Internet.

Não foram identificados motivos para alterar funcionalidades estáveis ou remover
dados demo, fixtures ou o sprite partilhado nesta etapa. Nenhuma destas pendências
foi convertida numa alteração funcional sem revisão do utilizador.

## Passos para encerrar

- Rever o PR documental e os respetivos checks, depois efetuar Squash and merge.
- Confirmar CI e deployment Vercel do novo commit de main.
- Sincronizar main e comparar o conteúdo antes de limpar a branch documental.
- Publicar o link de demonstração e o resumo do projeto no portefólio/CV.
- Decidir LinkedIn e licença, mantendo explícitas quaisquer limitações aceites.

Sem merge automático, alterações diretas na main, novas funcionalidades ou
modificações da configuração Vercel.
