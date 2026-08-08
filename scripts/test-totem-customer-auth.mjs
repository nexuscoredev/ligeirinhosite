import assert from 'node:assert/strict';
import {
    deriveTotemLogin,
    deriveTotemLoginFromQuery,
    loginParaEmail,
    resolveTotemAuthEmail,
    validateTotemPassword,
} from './lib/totem-customer-auth.mjs';

assert.equal(deriveTotemLogin({ cnpj: '45028186000125' }), '45028186000125');
assert.equal(deriveTotemLogin({ cpf: '12345678909' }), '12345678909');
assert.equal(deriveTotemLogin({ phone: '(11) 99999-8888' }), '11999998888');
assert.equal(deriveTotemLogin({ email: 'cliente@exemplo.com' }), 'cliente@exemplo.com');

assert.equal(deriveTotemLoginFromQuery('cliente@exemplo.com', { type: 'email' }), 'cliente@exemplo.com');
assert.equal(deriveTotemLoginFromQuery('11999998888'), '11999998888');

assert.equal(loginParaEmail('11999998888'), '11999998888@hub.ligeirinho.com');
assert.equal(resolveTotemAuthEmail('cliente@exemplo.com'), 'cliente@exemplo.com');
assert.equal(resolveTotemAuthEmail('11999998888'), '11999998888@hub.ligeirinho.com');

assert.throws(() => validateTotemPassword('123'), /6 caracteres/);
assert.equal(validateTotemPassword('abc123'), 'abc123');

console.log('test-totem-customer-auth: ok');
