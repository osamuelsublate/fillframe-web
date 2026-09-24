import { useEffect, useState } from 'react'
import { ErroApi } from '../api/cliente'
import {
  useGerarCriacao,
  useSalvarCriacao,
  type Criacao,
  type Orientacao,
  type Papel,
  type ReferenciaUsada,
} from '../api/criacoes'
import { useModelos, type ModeloMidia, type TipoMidia } from '../api/modelos'
import type { Referencia } from '../api/referencias'
import { proporcaoPara } from '../utils/proporcao'
import SeletorModelo, { CartaoModelo } from './SeletorModelo'

// Valores iniciais de uma criação nova (ex.: "Usar como referência" abre um vídeo com a imagem no 1º quadro).
export type InicioCriacao = {
  tipo: TipoMidia
  orientacao: Orientacao
  referencias: ReferenciaUsada[]
}

type Props = {
  sessaoId: string
  criacao: Criacao | null
  inicio?: InicioCriacao | null
  referenciasDaSessao: Referencia[]
  aoNovaVersao?: (criacaoId: string) => void
  aoFechar: () => void
}

const NOMES_PAPEL: Record<Papel, string> = {
  referencia: 'Referência de estilo',
  primeiro_quadro: 'Primeiro quadro',
  ultimo_quadro: 'Último quadro',
}

// Papéis que o modelo aceita (a OpenRouter diz que referência de imagem funciona em todo modelo de vídeo).
function papeisAceitos(tipo: TipoMidia, modelo: ModeloMidia | null): Papel[] {
  if (!modelo) return []
  const c = modelo.capacidades
  const papeis: Papel[] = []
  if (c.aceita_referencia !== false && (tipo === 'video' || (c.max_referencias ?? 0) > 0)) papeis.push('referencia')
  if (tipo === 'video' && c.aceita_primeiro_quadro) papeis.push('primeiro_quadro')
  if (tipo === 'video' && c.aceita_ultimo_quadro) papeis.push('ultimo_quadro')
  return papeis
}

// Largura e altura reais de uma imagem (para avisar quando a orientação não combina).
function useDimensoes(url: string | null) {
  const [dimensoes, setDimensoes] = useState<{ url: string; largura: number; altura: number } | null>(null)
  useEffect(() => {
    if (!url) return
    const imagem = new Image()
    imagem.onload = () => setDimensoes({ url, largura: imagem.naturalWidth, altura: imagem.naturalHeight })
    imagem.src = url
  }, [url])
  return dimensoes && dimensoes.url === url ? dimensoes : null
}

// Configuração de uma criação (imagem ou vídeo) antes de gerar.
export default function ConfigCriacao({
  sessaoId,
  criacao,
  inicio,
  referenciasDaSessao,
  aoNovaVersao,
  aoFechar,
}: Props) {
  // Só rascunho se edita. Uma versão gerada fica como está: para mudar, cria-se outra versão.
  const somenteLeitura = criacao !== null && criacao.situacao !== 'rascunho'
  const [tipo, setTipo] = useState<TipoMidia>(criacao?.tipo ?? inicio?.tipo ?? 'imagem')
  const [modeloId, setModeloId] = useState<string | null>(criacao?.modelo ?? null)
  const [trocandoModelo, setTrocandoModelo] = useState(!criacao)
  const [prompt, setPrompt] = useState(criacao?.prompt ?? '')
  const [orientacao, setOrientacao] = useState<Orientacao>(criacao?.orientacao ?? inicio?.orientacao ?? 'vertical')
  const [referencias, setReferencias] = useState<ReferenciaUsada[]>(
    criacao?.referencias ?? inicio?.referencias ?? [],
  )
  const [resolucao, setResolucao] = useState<string | null>(criacao?.resolucao ?? null)
  const [duracao, setDuracao] = useState<number | null>(criacao?.duracao_segundos ?? null)
  const [comAudio, setComAudio] = useState<boolean>(criacao?.parametros_extras?.generate_audio === true)

  const salvar = useSalvarCriacao(sessaoId)
  const gerar = useGerarCriacao(sessaoId)
  const [gerarDepois, setGerarDepois] = useState(false)
  const modelos = useModelos(tipo, '')
  const modelo = modelos.data?.find((m) => m.id === modeloId) ?? null
  const resolucoes = modelo?.capacidades.resolucoes ?? []
  const proporcao = modelo ? proporcaoPara(orientacao, modelo.capacidades.proporcoes) : null
  const duracoes = [...(modelo?.capacidades.duracoes ?? [])].sort((a, b) => a - b)
  const ehVideo = tipo === 'video'
  const papeis = papeisAceitos(tipo, modelo)
  const imagensDaSessao = referenciasDaSessao.filter((r) => r.tipo === 'imagem')
  const primeiroQuadro = referencias.find((r) => r.papel === 'primeiro_quadro')
  const urlPrimeiroQuadro = referenciasDaSessao.find((r) => r.id === primeiroQuadro?.id)?.url ?? null
  const dimensoesQuadro = useDimensoes(ehVideo ? urlPrimeiroQuadro : null)
  const orientacaoDoQuadro = dimensoesQuadro
    ? dimensoesQuadro.altura > dimensoesQuadro.largura
      ? 'vertical'
      : dimensoesQuadro.largura > dimensoesQuadro.altura
        ? 'horizontal'
        : null
    : null

  function papelDe(id: string): Papel | null {
    return referencias.find((r) => r.id === id)?.papel ?? null
  }

  function mudarPapel(id: string, papel: Papel | null) {
    setReferencias((atuais) => {
      // Primeiro e último quadro: só uma imagem em cada.
      const semEla = atuais.filter((r) => r.id !== id && (papel === 'referencia' || r.papel !== papel))
      return papel ? [...semEla, { id, papel }] : semEla
    })
  }

  const erro = salvar.error instanceof ErroApi ? salvar.error : null
  const erroDo = (campo: string) => (erro?.campo === campo ? erro.message : null)
  const erroGeral = erro && !['modelo', 'prompt', 'orientacao', 'proporcao', 'resolucao', 'duracao', 'audio', 'referencias'].includes(erro.campo ?? '')
    ? erro.message
    : salvar.error && !erro
      ? salvar.error.message
      : null

  function aoSalvar(evento: React.FormEvent) {
    evento.preventDefault()
    enviar(false)
  }

  function enviar(eGerar: boolean) {
    if (!modeloId || somenteLeitura) return
    setGerarDepois(eGerar)
    salvar.mutate(
      {
        id: criacao?.id ?? null,
        config: {
          tipo,
          modelo: modeloId,
          prompt,
          orientacao,
          resolucao,
          duracao: ehVideo ? duracao : null,
          parametros_extras: ehVideo && modelo?.capacidades.gera_audio ? { generate_audio: comAudio } : null,
          referencias,
        },
      },
      {
        onSuccess: (salva) => {
          // Gerar continua sendo um clique da pessoa: aqui só junta "salvar" e "gerar" num botão.
          if (eGerar) gerar.mutate(salva.id, { onSuccess: aoFechar })
          else aoFechar()
        },
      },
    )
  }

  return (
    <form onSubmit={aoSalvar} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2">
        <button type="button" onClick={aoFechar} className="text-sm text-stone-600 hover:text-stone-900">
          ← Criações
        </button>
        <span className="text-sm font-medium">
          {somenteLeitura
            ? `Configuração da v${criacao.numero_versao}`
            : criacao
              ? `Editar rascunho${criacao.numero_versao > 1 ? ` (v${criacao.numero_versao})` : ''}`
              : 'Nova criação'}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {somenteLeitura && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Versões prontas não mudam. Crie uma nova versão.
          </p>
        )}
        {/* Numa versão já gerada, todos os campos ficam travados. */}
        <fieldset disabled={somenteLeitura} className="min-w-0 space-y-5 disabled:opacity-70">
          <Campo rotulo="Tipo">
            <Alternador
              opcoes={[
                { valor: 'imagem', rotulo: 'Imagem' },
                { valor: 'video', rotulo: 'Vídeo' },
              ]}
              valor={tipo}
              aoMudar={(novo) => {
                if (novo === tipo) return
                setTipo(novo as TipoMidia)
                setModeloId(null)
                setTrocandoModelo(true)
                setResolucao(null)
                setDuracao(null)
                // Primeiro e último quadro só existem em vídeo.
                if (novo !== 'video') setReferencias((atuais) => atuais.filter((r) => r.papel === 'referencia'))
              }}
            />
          </Campo>

          <Campo rotulo="Modelo" erro={erroDo('modelo')}>
            {modelo && !trocandoModelo ? (
              <div className="space-y-1.5">
                <CartaoModelo modelo={modelo} tipo={tipo} selecionado />
                <button
                  type="button"
                  onClick={() => setTrocandoModelo(true)}
                  className="text-xs text-stone-600 underline hover:text-stone-900"
                >
                  Trocar modelo
                </button>
              </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <SeletorModelo
                    tipo={tipo}
                    modeloId={modeloId}
                    aoEscolher={(escolhido) => {
                      setModeloId(escolhido.id)
                      setTrocandoModelo(false)
                      // Vídeo: já deixa a menor duração aceita escolhida, se a atual não servir.
                      const aceitas = [...escolhido.capacidades.duracoes].sort((a, b) => a - b)
                      if (tipo === 'video' && aceitas.length && (duracao === null || !aceitas.includes(duracao))) {
                        setDuracao(aceitas[0])
                      }
                      if (!escolhido.capacidades.gera_audio) setComAudio(false)
                    }}
                  />
                </div>
            )}
          </Campo>

          <Campo rotulo="Prompt" erro={erroDo('prompt')}>
            <textarea
              value={prompt}
              onChange={(evento) => setPrompt(evento.target.value)}
              rows={5}
              aria-label="Prompt"
              placeholder={
                ehVideo
                  ? 'Descreva o vídeo: o que aparece, o movimento, a câmera, o estilo…'
                  : 'Descreva a imagem: o que aparece, estilo, textos na tela…'
              }
              className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </Campo>

          <Campo rotulo="Formato" erro={erroDo('orientacao') ?? erroDo('proporcao')}>
            <Alternador
              opcoes={[
                { valor: 'vertical', rotulo: 'Vertical' },
                { valor: 'horizontal', rotulo: 'Horizontal' },
              ]}
              valor={orientacao}
              aoMudar={(novo) => setOrientacao(novo as Orientacao)}
            />
            {orientacaoDoQuadro && orientacaoDoQuadro !== orientacao && (
              <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                A imagem do primeiro quadro é {orientacaoDoQuadro} e o vídeo está {orientacao}: o vídeo vai ter faixas
                pretas. Use {orientacaoDoQuadro} para ocupar a tela toda.
              </p>
            )}
            {modelo && (
              <p className="mt-1.5 text-xs text-stone-500">
                {proporcao
                  ? `Proporção usada: ${proporcao}`
                  : modelo.capacidades.proporcoes.length
                    ? `Este modelo não faz ${orientacao}.`
                    : 'Este modelo não permite escolher a proporção.'}
              </p>
            )}
          </Campo>

          {ehVideo && (
            <Campo rotulo="Duração" erro={erroDo('duracao')}>
              <select
                value={duracao ?? ''}
                onChange={(evento) => setDuracao(evento.target.value ? Number(evento.target.value) : null)}
                aria-label="Duração"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
              >
                <option value="">Escolha a duração</option>
                {duracao !== null && !duracoes.includes(duracao) && (
                  <option value={duracao}>{duracao} s (não aceita por este modelo)</option>
                )}
                {duracoes.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao} segundos
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {ehVideo && modelo?.capacidades.gera_audio && (
            <Campo rotulo="Áudio" erro={erroDo('audio')}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={comAudio}
                  onChange={(evento) => setComAudio(evento.target.checked)}
                  className="h-4 w-4"
                />
                Gerar áudio junto com o vídeo (costuma custar mais)
              </label>
            </Campo>
          )}

          <Campo rotulo="Referências" erro={erroDo('referencias')}>
            {imagensDaSessao.length === 0 ? (
              <p className="text-xs text-stone-500">
                Nenhuma imagem na sessão. Anexe imagens no chat ou use "Usar como referência" numa imagem gerada.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {imagensDaSessao.map((referencia) => {
                  const papel = papelDe(referencia.id)
                  // Papel escolhido que não está na lista: ainda sem modelo, ou o modelo não aceita.
                  const foraDaLista = papel !== null && !papeis.includes(papel)
                  const invalido = foraDaLista && modelo !== null
                  return (
                    <li key={referencia.id} className="flex items-center gap-2">
                      <img
                        src={referencia.url}
                        alt={referencia.nome_original ?? 'Imagem de referência'}
                        className="h-12 w-12 shrink-0 rounded-md border border-stone-200 object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-stone-600">
                        {referencia.nome_original ?? 'imagem'}
                      </span>
                      <select
                        value={papel ?? ''}
                        onChange={(evento) => mudarPapel(referencia.id, (evento.target.value || null) as Papel | null)}
                        aria-label={`Uso de ${referencia.nome_original ?? 'imagem'}`}
                        className={`rounded-md border bg-white px-2 py-1 text-xs outline-none ${
                          invalido ? 'border-red-300 text-red-800' : 'border-stone-300'
                        }`}
                      >
                        <option value="">Não usar</option>
                        {foraDaLista && (
                          <option value={papel}>
                            {NOMES_PAPEL[papel]}
                            {invalido ? ' (este modelo não aceita)' : ''}
                          </option>
                        )}
                        {papeis.map((opcao) => (
                          <option key={opcao} value={opcao}>
                            {NOMES_PAPEL[opcao]}
                          </option>
                        ))}
                      </select>
                    </li>
                  )
                })}
              </ul>
            )}
            {modelo && ehVideo && !modelo.capacidades.aceita_ultimo_quadro && (
              <p className="mt-1.5 text-xs text-stone-500">Este modelo não aceita último quadro.</p>
            )}
            {modelo && ehVideo && !modelo.capacidades.aceita_primeiro_quadro && (
              <p className="mt-1.5 text-xs text-stone-500">Este modelo não aceita primeiro quadro.</p>
            )}
          </Campo>

          <Campo rotulo="Resolução" erro={erroDo('resolucao')}>
            <select
              value={resolucao ?? ''}
              onChange={(evento) => setResolucao(evento.target.value || null)}
              aria-label="Resolução"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="">Padrão do modelo</option>
              {resolucao && !resolucoes.includes(resolucao) && (
                <option value={resolucao}>{resolucao} (não aceita por este modelo)</option>
              )}
              {resolucoes.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </Campo>

          {gerar.isError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              O rascunho foi salvo, mas não deu para gerar: {gerar.error.message}
            </p>
          )}
          {erroGeral && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{erroGeral}</p>}
        </fieldset>
      </div>

      {somenteLeitura ? (
        <div className="border-t border-stone-200 p-3">
          <button
            type="button"
            onClick={() => aoNovaVersao?.(criacao.id)}
            disabled={!aoNovaVersao || criacao.situacao === 'apagado'}
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            Nova versão a partir desta
          </button>
        </div>
      ) : (
      <div className="flex gap-2 border-t border-stone-200 p-3">
        <button
          type="submit"
          disabled={!modeloId || salvar.isPending || gerar.isPending}
          title={!modeloId ? 'Escolha um modelo primeiro' : undefined}
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
        >
          {salvar.isPending && !gerarDepois ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button
          type="button"
          onClick={() => enviar(true)}
          disabled={!modeloId || salvar.isPending || gerar.isPending}
          title={!modeloId ? 'Escolha um modelo primeiro' : undefined}
          className="flex-1 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {gerarDepois && (salvar.isPending || gerar.isPending) ? 'Enviando…' : 'Salvar e gerar'}
        </button>
      </div>
      )}
    </form>
  )
}

function Campo({ rotulo, erro, children }: { rotulo: string; erro?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-wide text-stone-500 uppercase">{rotulo}</p>
      {children}
      {erro && (
        <p role="alert" className="mt-1.5 text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  )
}

type Opcao = { valor: string; rotulo: string; desativado?: string }

function Alternador({ opcoes, valor, aoMudar }: { opcoes: Opcao[]; valor: string; aoMudar: (valor: string) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-sm">
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          onClick={() => aoMudar(opcao.valor)}
          disabled={!!opcao.desativado}
          title={opcao.desativado}
          aria-pressed={valor === opcao.valor}
          className={`rounded-md px-3 py-1 disabled:cursor-not-allowed disabled:text-stone-400 ${
            valor === opcao.valor ? 'bg-white font-medium shadow-sm' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}
