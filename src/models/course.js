// COURSE MODEL

const mongoose=require('mongoose');

const courseSchema=new mongoose.Schema(
    {
        name : {
            type : String,
            required : [true, 'Please add a course name'],
            trim : true,
            maxlength : [50, 'Course name cannot exceed 50 characters']
        },
        description : {
            type : String,
            default : '',
            trim : true,
            maxlength : [150, 'Description cannot exceed 150 characters']
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
            default : 0,
            min : 0
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
            required : [true, 'Created by user Id is required']
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

courseSchema.index({ name : 1, tenantId : 1 },{ unique : true });
courseSchema.index({ tenantId : 1, createdAt : -1 });

module.exports=mongoose.model('Course',courseSchema);