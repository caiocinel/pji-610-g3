"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Dialog, Input, mostrarToastResultado } from "@/components/ui";
import { criarCategoria, excluirCategoria, renomearCategoria } from "@/lib/dominio/acoes/categorias";
import { chamarAcao } from "@/lib/dominio/resultado";

/** Campo + botão para criar categoria; limpa e devolve o foco ao campo após criar. */
export function NovaCategoriaForm() {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [pendente, iniciar] = useTransition();

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciar(async () => {
      const r = await chamarAcao(criarCategoria({ nome }));
      if (mostrarToastResultado(r)) {
        setNome("");
        setErro(undefined);
        document.getElementById("nova_categoria_nome")?.focus();
      } else {
        setErro(r.campos?.nome ?? r.erro);
      }
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Input
        id="nova_categoria_nome"
        name="nome"
        label="Nova categoria"
        labelOculto
        required
        maxLength={60}
        autoComplete="off"
        placeholder="Nome da nova categoria (ex.: Velas em pote)"
        icone={<Tags />}
        value={nome}
        onChange={(e) => {
          setNome(e.currentTarget.value);
          setErro(undefined);
        }}
        erro={erro}
        wrapperClassName="min-w-0 flex-1"
      />
      <Button type="submit" icone={<Plus />} carregando={pendente} textoCarregando="Criando…" disabled={!nome.trim()}>
        Criar categoria
      </Button>
    </form>
  );
}

/** Ações de uma categoria: renomear (diálogo) e excluir (só quando nenhuma vela ativa usa). */
export function AcoesCategoria({ id, nome, ativos }: { id: number; nome: string; ativos: number }) {
  const [aberto, setAberto] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [erro, setErro] = useState<string | undefined>();
  const [pendente, iniciar] = useTransition();

  function abrir() {
    setNovoNome(nome);
    setErro(undefined);
    setAberto(true);
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (novoNome.trim() === nome) {
      setAberto(false);
      return;
    }
    iniciar(async () => {
      const r = await chamarAcao(renomearCategoria({ id, nome: novoNome }));
      if (mostrarToastResultado(r)) setAberto(false);
      else setErro(r.campos?.nome ?? r.erro);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button variante="fantasma" tamanho="sm" icone={<Pencil />} onClick={abrir} aria-label={`Renomear ${nome}`}>
        <span className="hidden sm:inline">Renomear</span>
      </Button>
      {ativos === 0 ? (
        <ConfirmDialog
          gatilho={{ rotulo: `Excluir ${nome}`, somenteIcone: true, variante: "fantasma", tamanho: "sm", icone: <Trash2 /> }}
          titulo={`Excluir a categoria “${nome}”?`}
          descricao="Nenhuma vela ativa usa esta categoria. Velas desativadas que estiverem nela ficam sem categoria."
          tom="perigo"
          confirmar="Excluir"
          confirmando="Excluindo…"
          cancelar="Voltar"
          acao={excluirCategoria}
          campos={{ id }}
        />
      ) : (
        <span
          className="px-2 text-xs text-suave"
          title="Para excluir, mude antes a categoria das velas que a usam."
        >
          Em uso
        </span>
      )}

      <Dialog
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Renomear categoria"
        descricao="O novo nome aparece em todas as velas desta categoria."
        tamanho="sm"
      >
        <form onSubmit={salvar} className="pb-5 sm:pb-6">
          <Input
            name={`nome_${id}`}
            label="Nome da categoria"
            required
            maxLength={60}
            autoFocus
            autoComplete="off"
            value={novoNome}
            onChange={(e) => {
              setNovoNome(e.currentTarget.value);
              setErro(undefined);
            }}
            erro={erro}
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" carregando={pendente} textoCarregando="Salvando…" disabled={!novoNome.trim()}>
              Salvar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
