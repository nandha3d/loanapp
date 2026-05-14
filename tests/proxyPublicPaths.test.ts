import assert from 'node:assert/strict';
import { isPublicPath } from '../proxy';

assert.equal(isPublicPath('/fonts/MaterialIconsOutlined-Regular.otf'), true);
assert.equal(isPublicPath('/assets/logo.svg'), true);
assert.equal(isPublicPath('/dashboard'), false);

console.log('proxy public path tests passed');
