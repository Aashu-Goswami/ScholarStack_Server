const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
        name : {
            type : String,
            required : [true, 'Please add a name'],
            trim : true
        },
        email : {
            type : String,
            required : [true, 'Please add an email'],
            unique : false,
            lowercase : true,
            trim : true,
            match : [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
        },
        passwordHash : {
            type : String,
            required : true
        },
        role : {
            type : String,
            enum : ['superAdmin', 'instAdmin', 'student'],
            default : 'student',
            required : true
        },
        tenantId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Institution',
            default : null
        },
        institutionAdminId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'User',
            default : null
        },
        isEmailVerified : {
            type : Boolean,
            default : false
        },
        emailVerificationToken : String,
        emailVerificationExpire : Date,
        resetPasswordToken : String,
        resetPasswordExpire : Date
    },
    {
        timestamps : true
    }
);

userSchema.index(
    {
        email : 1,
        tenantId : 1
    },
    { 
        unique : true,
        partialFilterExpression : { tenantId : { $ne : null } }
    }
);

module.exports = mongoose.model('User', UserSchema); 