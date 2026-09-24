import { useState } from 'react'
import { ErroApi } from '../api/cliente'
import { useGerarCriacao, useSalvarCriacao, type Criacao, type Orientacao } from '../api/criacoes'
import { useModelos, type TipoMidia } from '../api/modelos'
import { proporcaoPara } from '../utils/proporcao'
import SeletorModelo, { CartaoModelo } from './SeletorModelo'

type Props = {
  sessaoId: string
  criacao: Criacao | null
  aoFechar: () => void
}

// Configuração de uma criação (imagem ou vídeo) antes de gerar.
export default function ConfigCriacao({ sessaoId, criacao, aoFechar }: Props) {
  const [tipo, setTipo] = useState<TipoMidia>(criacao?.tipo ?? 'imagem')
  const [modeloId, setModeloId] = useState<string | null>(criacao?.modelo ?? null)
  const [trocandoModelo, setTrocandoModelo] = useState(!criacao)
  const [prompt, setPrompt] = useState(criacao?.prompt ?? '')
  const [orientacao, setOrientacao] = useState<Orientacao>(criacao?.orientacao ?? 'vertical')
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

  const erro = salvar.error instanceof ErroApi ? salvar.error : null
  const erroDo = (campo: string) => (erro?.campo === campo ? erro.message : null)
  const erroGeral = erro && !['modelo', 'prompt', 'orientacao', 'proporcao', 'resolucao', 'duracao', 'audio'].includes(erro.campo ?? '')
    ? erro.message
    : salvar.error && !erro
      ? salvar.error.message
      : null

  function aoSalvar(evento: React.FormEvent) {
    evento.preventDefault()
    enviar(false)
  }

  function enviar(eGerar: boolean) {
    if (!modeloId) return
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
        <span className="text-sm font-medium">{criacao ? 'Editar rascunho' : 'Nova criação'}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
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
      </div>

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
