const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        tenantId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Institution',
            required : [true, 'Tenant ID is required'],
            index : true
        },
        applicationId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Application',
            required : [true, 'Application ID is required'],
            index : true
        },
        fromStatus : {
            type : String,
            enum : ['draft', 'submitted', 'under_review', 'verified', 'admitted', 'rejected'],
            required : [true, 'From status is required']
        },
        toStatus : {
            type : String,
            enum : ['draft', 'submitted', 'under_review', 'verified', 'admitted', 'rejected'],
            required : [true, 'To status is required']
        },
        changedBy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            required : [true, 'Changed by user ID is required']
        },
        changedAt : {
            type : Date,
            default : Date.now
        }, 
        remarks : {
            type : String,
            default : '',
            trim : true,
            maxlength : [500, 'Remarks cannot exceed 500 characters']
        }
    },
    {
        timestamps : true
    }
);

auditLogSchema.index({ tenantId: 1, changedAt: -1 });
auditLogSchema.index({ applicationId : 1, changedAt : -1 });
auditLogSchema.index({ tenantId : 1, toStatus : 1, changedAt : -1 });

auditLogSchema.pre('save', async function() {
  if (this.fromStatus === this.toStatus) {
    throw new Error('From status and to status cannot be the same');
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
