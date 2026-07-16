// APPLICATION MODEL

const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institution',
            required: [true, 'Application must belong to an institution']
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, 'Application must be for a course']
        },
        applicantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Application must belong to a student']
        },
        personalDetails: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        documents: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Document'
            }
        ],
        session: {
            type: String,
            default: '',
            trim : true
        },
        status: {
            type: String,
            enum: ['draft', 'submitted', 'under_review', 'verified', 'admitted', 'rejected'],
            default: 'draft',
            required : true
        },
        classification : {
            type : mongoose.Schema.Types.Mixed,
            default : {}
        },
        submittedAt : {
            type : Date,
            default : null
        },
        remarks: {
            type: String,
            default: '',
            trim : true,
            maxlength : [250, 'Remarks cannot exceed 250 characters']
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

applicationSchema.index({ tenantId : 1, createdAt : -1 });
applicationSchema.index({ tenantId : 1, status : 1 });
applicationSchema.index({ tenantId : 1, courseId : 1 });
applicationSchema.index({ tenantId : 1, applicantId : 1 });

applicationSchema.index({ applicantId: 1, tenantId: 1, createdAt: -1 });
applicationSchema.index({ tenantId: 1, courseId: 1, applicantId: 1 }, { unique: false });
applicationSchema.index({ createdAt: 1 });

applicationSchema.pre('save', async function() {
    if (this.isModified('status')) {
        if (this.status === 'submitted' && !this.submittedAt) {
            this.submittedAt = new Date();
        }
        if (this.status === 'draft') {
            this.submittedAt = null;
        }
    }
    if (this.isModified('reviewedBy') && this.reviewedBy) {
        this.reviewedAt = new Date();
    }
});

module.exports = mongoose.model('Application', applicationSchema);
