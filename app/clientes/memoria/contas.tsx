import { FONTES_CLIENTE, TIPOS_CONTA, type ContaCliente } from '@/lib/ficha-cliente';
import { dataHora } from '@/lib/formato';
import { botao, botaoSec, campo, Secao, Vazio } from '@/components/ui';
import { acaoVinculoCliente } from '../ficha-acoes';

function CamposVinculo({ conta }: { conta?: ContaCliente }) {
  return <>
    <label className="grid gap-1">Integração<select name="integracao" className={campo} defaultValue={conta?.integracao ?? 'meta-ads'}>
      {Object.entries(FONTES_CLIENTE).map(([k,v]) => <option key={k} value={k}>{v.nome}</option>)}
    </select></label>
    <label className="grid gap-1">Tipo<select name="tipo" className={campo} defaultValue={conta?.tipo ?? 'conta_anuncio'}>
      {Object.entries(TIPOS_CONTA).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
    </select></label>
    <label className="grid gap-1">Identificador<input name="identificador" className={campo} required maxLength={200} defaultValue={conta?.identificador} /></label>
    <label className="grid gap-1">Rótulo<input name="rotulo" className={campo} required minLength={2} maxLength={120} defaultValue={conta?.rotulo} /></label>
  </>;
}

export function ContasFicha({ cliente, contas, admin }: { cliente: string; contas: ContaCliente[]; admin: boolean }) {
  return <Secao titulo="Contas vinculadas" total={contas.length} id="contas">
    {!contas.length && <Vazio>Nenhuma conta vinculada.</Vazio>}
    {Object.entries(FONTES_CLIENTE).map(([id,f]) => {
      const grupo = contas.filter(a => a.integracao === id);
      return grupo.length > 0 && <section key={id} className="px-3 py-2">
        <h3 className="font-semibold">{f.nome}</h3>
        <ul className="divide-y divide-vx-linha">
          {grupo.map(a => <li key={a.id} className="space-y-1 py-2">
            <p className="font-medium">{a.rotulo} · {TIPOS_CONTA[a.tipo]}</p>
            <p className="text-sm"><code>{a.identificador}</code> · {a.verificado_em ? `Verificado em ${dataHora(a.verificado_em)} por ${a.verificador ?? a.verificado_por}` : 'Aguardando verificação'}</p>
            {admin && <details>
              <summary className="cursor-pointer text-sm font-medium">Gerenciar vínculo</summary>
              <form action={acaoVinculoCliente} className="mt-2 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="cliente" value={cliente} />
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="versao" value={a.versao} />
                <CamposVinculo conta={a} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button name="acao" value="salvar" className={botao}>Salvar edição</button>
                  <button name="acao" value="verificar" className={botaoSec}>Verificar vínculo</button>
                  <button name="acao" value="remover" className={botaoSec}>Remover vínculo</button>
                </div>
              </form>
            </details>}
          </li>)}
        </ul>
      </section>;
    })}
    {admin && <details className="m-2 rounded-lg border border-vx-linha p-3">
      <summary className="cursor-pointer font-semibold">Vincular conta</summary>
      <form action={acaoVinculoCliente} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="cliente" value={cliente} />
        <CamposVinculo />
        <div><button name="acao" value="salvar" className={botao}>Cadastrar vínculo</button></div>
      </form>
    </details>}
  </Secao>;
}
