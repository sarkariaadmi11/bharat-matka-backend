module.exports = (schema) => {
  schema.set('toJSON', {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;

      // Optionally hide timestamps globally unless specifically requested
      delete ret.createdAt;
      delete ret.updatedAt;

      return ret;
    },
    virtuals: true,
    versionKey: false,
  });
};
