const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : [true,'Please add a document name'],
            trim : true,
            maxLength : [100, 'Document name cannot exceed 100 characters']
        },
        type : {
            type : String,
            required : [true,'Please specify document type'],
            trim : true,
            enum : {
                values : ['marksheet', 'certificate', 'idProof', 'photo', 'other'],
                message : 'Document type must be one of : marksheet, certificate, identityProof, passportPhoto, other'
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
            enum : ['pending', 'approved', 'rejected'],
            default : 'pending',
            required : true
        },
        remarks : {
            type : String,
            default : '',
            trim : true,
            maxLength : [500, 'Remarks cannot exceed 500 characters']
        },
        studentId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            required : [true, 'Document must be associated with a student']
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

// Index to quickly query documents by application
documentSchema.index({ tenantId: 1, createdAt: -1 });
documentSchema.index({ tenantId: 1, status: 1 });
documentSchema.index({ applicationId: 1, tenantId: 1 });
documentSchema.index({ studentId: 1, tenantId: 1 });

module.exports = mongoose.model('Document', documentSchema);
