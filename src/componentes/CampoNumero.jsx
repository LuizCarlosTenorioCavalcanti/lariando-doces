import './campos.css'

/** O valor é TEXTO, e a conversão é de quem chama.
 *
 *  Enquanto ela digita "8," o conteúdo não é um número válido. Um campo controlado por
 *  número apagaria a vírgula no instante em que ela a digita, e o campo viraria uma luta. */
export function CampoNumero({ id, rotulo, valor, aoMudar, prefixo, sufixo, dica, autoFocus }) {
  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>{rotulo}</label>
      <div className="campo-caixa">
        {prefixo ? <span className="campo-fixo">{prefixo}</span> : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => aoMudar(e.target.value)}
        />
        {sufixo ? <span className="campo-fixo">{sufixo}</span> : null}
      </div>
      {dica ? <p className="campo-dica">{dica}</p> : null}
    </div>
  )
}
