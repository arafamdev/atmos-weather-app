# Atmos — Relatório de finalização para portefólio

Data: 17 de novembro de 2026, Europe/Lisbon.

Este relatório regista a finalização documental nessa data. A revisão de
arquitetura posterior está descrita no final, com as diferenças face a este
estado histórico.

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

## Revisão de arquitetura — 18 de novembro de 2026

Esta revisão substitui a decisão conservadora anterior de preservar dados demo
e wrappers do Porto. A alteração é feita em `chore/remove-unused-files`, baseada
na main `ebf95479ed3acedc7483f82b2022fcf8b14e1405`. Foram revistas e integradas
alterações locais já iniciadas, com autorização explícita do utilizador.

### Caminhos e responsabilidades atuais

Não existem pastas `api` nem ficheiros `locations` em `src`, `public` ou `tests`.
O histórico versionado consultado também não contém esses caminhos. Não é
possível atribuir uma origem a pastas vazias que nunca tenham sido versionadas.

`src/features/weather/utils/weatherLocation.js` continua necessário: centraliza
Porto como localização inicial, coordenadas, labels, validação e normalização de
timezones IANA. Tem consumidores na aplicação, serviço, hook, adaptador e testes.
Não é uma lista estática de cidades nem um módulo abandonado.

### Remoções e migrações

- `src/features/weather/data/demoWeather.js`: dados usados na primeira fase
  visual, sem consumidores executáveis após a integração Open-Meteo; removidos.
  A pasta `data` deixa de fazer parte da arquitetura.
- `src/features/weather/hooks/usePortoWeather.js`: wrapper da fase em que Porto
  era a única cidade. `useCityWeather()` já oferece o mesmo comportamento inicial;
  testes passam a usar o hook e as query options atuais diretamente.
- `fetchPortoWeather()` em `services/weatherService.js`: removido o wrapper sem
  lógica própria. Os testes de pedidos, erros e AbortSignal usam `fetchWeather`.
- `usePortoWeather.test.js` migra para `useCityWeather.lifecycle.test.js`, mantendo
  os 10 testes e as 48 asserções de loading, sucesso, cache, staleTime, erros,
  cancelamento, unsubscribe e refetch.
- `useCityWeather.test.js`: comparação dos wrappers substituída por equivalência
  entre Porto implícito e explícito, incluindo partilha de cache e estado nativo.
- `WeatherDashboard.test.js`: query options antigas substituídas pelas atuais,
  mantendo os cenários Retry, transições e dados em background.
- `weatherAdapter.js`, `CurrentWeatherCard.jsx`, `DailyForecastList.jsx`,
  `RainProbabilityChart.jsx` e `WeatherDashboard.jsx`: removidos metadados/props
  `isDemo` e badges que o único adaptador de produção mantinha sempre desativados.
  As asserções do adaptador passam a verificar identidade e consistência da
  localização real; valores e condições meteorológicas continuam testados.
- `public/icons.svg`: retirados apenas os símbolos sem referências no projeto
  `bluesky-icon`, `discord-icon`, `documentation-icon`, `social-icon` e `x-icon`.
  GitHub e LinkedIn são preservados integralmente, assim como o favicon separado.

Fixtures em `testing/`, os testes DOM em `tests/`, utilitários de localização e
timestamp, fallbacks meteorológicos e tratamento de dados opcionais são mantidos.
Não foram alterados endpoints, parâmetros, cache, DST, timezone, pesquisa,
acessibilidade, estilos ativos ou configuração Vercel. A compatibilidade ISO
permanece porque faz parte do contrato de timestamps e da cobertura útil.

Não se pressupõe que consumidores externos de fragmentos públicos antigos sejam
detetáveis: a remoção dos cinco símbolos limita-se ao catálogo sem consumidores
conhecidos deste projeto. Os dois fragmentos usados pela interface mantêm-se.

### Validação desta revisão

- `npm test`: 178 aprovados, 0 falhas, 0 ignorados; nenhum teste foi eliminado
  para reduzir a suite. O ficheiro de ciclo de vida foi migrado, não descartado.
- `npm run lint`, `npm run build` e `git diff --check`: aprovados.
- Comparação adicional do HTML SSR da main anterior e da refatorização em
  10 cenários: Porto/Tóquio × loading, erro inicial, sucesso, refetch e erro de
  refetch. Todas as comparações foram idênticas. Esta verificação de auditoria
  é separada dos 178 testes e não corresponde a testes visuais ou Safari físico.
- Símbolos GitHub/LinkedIn preservados sem alteração de conteúdo; favicon,
  tokens CSS, pesquisa, hooks atuais e configurações sem alterações.
- Sem imports executáveis dos wrappers/dados removidos, pastas vazias ou links
  locais Markdown quebrados após a migração.
