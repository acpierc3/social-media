const expect = require('chai').expect;

const authMiddleware = require('../middleware/isAuth');

describe('Auth Middleware', function () {
  it('should throw an error if no authorization is present', function () {
    const req = {
      get: function () {
        return null;
      }
    }
    expect(authMiddleware.bind(this, req, {}, () => { })).to.throw('Not authenticated.');


    
  })
})
