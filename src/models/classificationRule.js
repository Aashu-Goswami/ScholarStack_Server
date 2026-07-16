// CLASSIFICATION RULES MODEL

const mongoose = require('mongoose');

const ClassificationRuleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Tenant Id is  required'],
      unique: true
    },
    highMeritThreshold: {
      type: Number,
      default: 85,
      min: 0,
      max: 100
    },
    mediumMeritThreshold: {
      type: Number,
      default: 60,
      min: 0,
      max: 100
    },
    reservedCategories: {
      type: [String],
      default: ['SC', 'ST', 'OBC', 'EWS']
    },
    eligibilityMinMarks: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    courseSpecificRules: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ClassificationRule', ClassificationRuleSchema);