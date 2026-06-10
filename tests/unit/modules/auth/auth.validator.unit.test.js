const {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateResetPassword,
} = require('@modules/auth/auth.validator');

describe('auth.validator', () => {
  test('accepts a valid register payload', async () => {
    await expect(validateRegister({
      username: 'johndoe',
      phone: '9876543210',
      password: 'secret1',
      confirmPassword: 'secret1',
    })).resolves.toEqual({
      username: 'johndoe',
      phone: '9876543210',
      password: 'secret1',
      confirmPassword: 'secret1',
    });
  });

  test('rejects invalid register payload fields', async () => {
    await expect(validateRegister({
      username: 'ab',
      phone: '123',
      password: '12345',
      confirmPassword: '123456',
    })).rejects.toMatchObject({
      statusCode: 400,
      details: expect.arrayContaining([
        'username must be at least 3 characters long',
        'phone must be 10 digits',
        'password must be at least 6 characters long',
        'confirmPassword must match password',
      ]),
    });
  });

  test('rejects invalid login payload', async () => {
    await expect(validateLogin({
      phone: 'abcdefghij',
      password: '123',
    })).rejects.toMatchObject({
      statusCode: 400,
      details: expect.arrayContaining([
        'phone must be 10 digits',
        'password must be at least 6 characters long',
      ]),
    });
  });

  test('requires matching change-password confirmation', async () => {
    await expect(validateChangePassword({
      currentPassword: 'oldpass',
      newPassword: 'newpass',
      confirmPassword: 'wrongpass',
    })).rejects.toMatchObject({
      statusCode: 400,
      details: ['confirmPassword must match newPassword'],
    });
  });

  test('requires matching reset-password confirmation', async () => {
    await expect(validateResetPassword({
      resetToken: 'token',
      newPassword: 'newpass',
      confirmPassword: 'wrongpass',
    })).rejects.toMatchObject({
      statusCode: 400,
      details: ['confirmPassword must match newPassword'],
    });
  });
});
