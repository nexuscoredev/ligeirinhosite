import assert from 'node:assert/strict';
import { loginDigitsLookLikePhone } from './hub-parceiro.mjs';

assert.equal(loginDigitsLookLikePhone('11999998888'), true);
assert.equal(loginDigitsLookLikePhone('1133334444'), true);
assert.equal(loginDigitsLookLikePhone('12345678909'), false);
assert.equal(loginDigitsLookLikePhone('45028186000125'), false);
assert.equal(loginDigitsLookLikePhone('(11) 99999-8888'), true);

console.log('test-login-phone: ok');
