// Check da conversao de data local. Rodar: npm test
import assert from 'node:assert/strict'
import { dataISO } from './datas.js'

// 30/09 as 22h no fuso local. O caminho antigo, via toISOString em UTC-3,
// devolvia 01/10 e gravava a mensalidade no mes errado.
const noite = new Date(2026, 8, 30, 22, 0, 0)
assert.equal(dataISO(noite), '2026-09-30')

// Comeco do dia e fim do dia continuam no mesmo dia.
assert.equal(dataISO(new Date(2026, 8, 30, 0, 0, 0)), '2026-09-30')
assert.equal(dataISO(new Date(2026, 8, 30, 23, 59, 59)), '2026-09-30')

// Vencimento dia 5 montado com Date(ano, mes, dia) nao escorrega para o dia 4.
assert.equal(dataISO(new Date(2026, 9, 5)), '2026-10-05')

// Virada de ano.
assert.equal(dataISO(new Date(2026, 11, 31, 21, 30, 0)), '2026-12-31')

console.log('datas: ok')
