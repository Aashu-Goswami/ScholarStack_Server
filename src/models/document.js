const mongoose=require('mongoose');

const documentSchema=new mongoose.Schema(
    {
        name:{
            type:String,
            required:[true,'Please add a document name'],
            trim:true
        },
        type:{
            type:String,
            required:[true,'Please specify document type'],
            enum:['marksheet','certificate','idProof','photo']
        },
        fileUrl:{
            type:String,
            required:[true,'Please provide the uploaded document file path']
        },
        status: {
            type:String,
            enum:['pending', 'approved', 'rejected'],
            default:'pending'
        },
        remarks:{
            type:String,
            default:''
        },
        studentId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User',
            required:[true, 'Document must be associated with a student']
        },
        applicationId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Application',
            required:[true, 'Document must be linked to an application']
        },
        tenantId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Institution',
            required:[true,'Document must belong to an institution(tenant)']
        },
        reviewedBy:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User',
            default:null
        },
        reviewedAt:{
            type:Date,
            default:null
        }
    },
    {
        timestamps:true
    }
);

// Index to quickly query documents by application
documentSchema.index({applicationId:1});

module.exports=mongoose.model('Document',documentSchema);
