// Data do dia em YYYY-MM-DD, no fuso de quem esta usando o app.
//
// `new Date().toISOString().split('T')[0]` parece fazer isso, mas converte para
// UTC antes de cortar. No horario de Brasilia (UTC-3), das 21h a meia-noite o
// resultado ja e o dia seguinte. Uma mensalidade quitada as 22h de 30/09 era
// gravada como paga em 01/10, e a comparacao de vencimento errava o dia.
export function hojeISO(data = new Date()) {
  return dataISO(data)
}

// Mesma conversao para uma data qualquer, util para vencimento montado com
// `new Date(ano, mes, dia)`, que tambem nasce no fuso local.
export function dataISO(data) {
  const minutosDeOffset = data.getTimezoneOffset() * 60000
  return new Date(data.getTime() - minutosDeOffset).toISOString().split('T')[0]
}
