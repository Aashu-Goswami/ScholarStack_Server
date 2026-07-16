// DOCUMENT MODEL

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : [true,'Please add a document name'],
            trim : true,
            maxlength : [100, 'Document name cannot exceed 100 characters']
        },
        type : {
            type : String,
            required : [true,'Please specify document type'],
            trim : true,
            enum : {
                values : ['marksheet', 'certificate', 'idProof', 'photo', 'other'],
                message : 'Document type must be one of : marksheet, certificate, idProof, photo, other'
            },
            default : 'other'
        },
        fileUrl : {
            type : String,
            required : [true, 'Please provide the uploaded document file path'],
            trim : true
        },
        status : {
            type : String,
            enum : ['under review', 'approved', 'rejected'],
            default : 'under review',
            required : true
        },
        remarks : {
            type : String,
            default : '',
            trim : true,
            maxLength : [250, 'Remarks cannot exceed 250 characters']
        },
        applicantId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            required : [true, 'Document must be associated with an applicant']
        },
        applicationId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Application',
            required : [true, 'Document must be linked to an application']
        },
        tenantId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Institution',
            required : [true,'Document must belong to an institution(tenant)']
        },
        reviewedBy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            default : null
        },
        reviewedAt : {
            type : Date,
            default : null
        }
    },
    {
        timestamps : true
    }
);

documentSchema.index({ tenantId: 1, createdAt: -1 });
documentSchema.index({ tenantId: 1, status: 1 });
documentSchema.index({ applicationId: 1, tenantId: 1 });
documentSchema.index({ applicantId: 1, tenantId: 1 });

documentSchema.pre('save', async function() {
    if (this.isModified('reviewedBy')) {
        if (this.reviewedBy) {
            this.reviewedAt = new Date();
        } else {
            this.reviewedAt = null;
        }
    }
});


module.exports = mongoose.model('Document', documentSchema);
