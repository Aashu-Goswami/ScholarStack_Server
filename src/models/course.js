const mongoose=require('mongoose');

const courseSchema=new mongoose.Schema(
    {
        name : {
            type : String,
            required : [true, 'Please add a course name'],
            trim : true
        },
        description : {
            type : String,
            default : '',
            trim : true
        },
        tenantId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Institution',
            required : [true,'Course must belong to an institution']
        },
        eligibilityCriteria : {
            type : mongoose.Schema.Types.Mixed,
            default : {}
        },
        admissionCapacity : {
            type : Number,
            default : 0
        },
        requiredDocuments : {
            type : [String],
            default : []
        },
        session : {
            type : String,
            default : '',
            trim : true
        },
        createdBy : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            required : true
        },
        isActive : {
            type : Boolean,
            default : true
        }
    },
    {
        timestamps:true
    }
);

// Compound index to ensure course name is unique per institution (tenant)
courseSchema.index({ name : 1, tenantId : 1 },{ unique : true });
courseSchema.index({ tenantId : 1, createdAt : -1 });

module.exports=mongoose.model('Course',courseSchema);