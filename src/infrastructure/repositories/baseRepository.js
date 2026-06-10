/**
 * Base Repository
 * Abstract repository with common database operations
 * All specific repositories should extend this
 */

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  /**
   * Create a new document with session support
   */
  async create(data, session = null) {
    const document = new this.model(data);
    // Passing session to save ensures this is part of a transaction
    return await document.save({ session });
  }

  async findOne(filter, session = null) {
    return await this.model.findOne(filter).session(session);
  }

  /**
   * Find document by ID - Modified to handle optional sessions
   */
  async findById(id, session = null) {
    const document = await this.model.findById(id).session(session);
    if (!document) {
      throw new Error(`${this.model.modelName} not found`);
    }
    return document;
  }

  /**
   * Find by custom filter
   */
  async findByFilter(filter, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const documents = await this.model
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await this.model.countDocuments(filter);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async find(filter = {}) {
    return await this.model.find(filter).sort({ createdAt: -1 });
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const documents = await this.model
      .find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await this.model.countDocuments();

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update document by ID - Modified to support sessions
   */
  async update(id, updateData, session = null) {
    const document = await this.model.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
        session, // Critical for Wallet updates
      },
    );

    if (!document) {
      throw new Error(`${this.model.modelName} not found`);
    }
    return document;
  }

  /**
   * Delete document by ID
   */
  async delete(id) {
    const document = await this.model.findByIdAndDelete(id);
    if (!document) {
      throw new Error(`${this.model.modelName} not found`);
    }
    return document;
  }

  /**
   * Alias for delete (to match Service layer calls)
   */
  async deleteById(id) {
    return await this.delete(id);
  }

  /**
   * Delete multiple documents
   */
  async deleteMany(filter) {
    return await this.model.deleteMany(filter);
  }

  /**
   * Count documents
   */
  async count(filter = {}) {
    return await this.model.countDocuments(filter);
  }

  /**
   * Check if document exists
   */
  async exists(filter) {
    return await this.model.exists(filter);
  }

  /**
   * Update many documents
   */
  async updateMany(filter, updateData) {
    return await this.model.updateMany(
      filter,
      { ...updateData, updatedAt: Date.now() },
    );
  }
}

module.exports = BaseRepository;
