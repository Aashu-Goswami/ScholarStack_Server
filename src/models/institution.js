// INSTITUTION MODEL

const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : [true, 'Please add institution name'],
            trim : true,
            maxlength : [50, 'Institution name cannot be more than 50 characters']
        },
        subdomain : {
            type : String,
            required : [true, 'Please add a subdomain'],
            unique : true,
            lowercase : true,
            trim : true,
            match : [/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'],
            maxlength : [50, 'Subdomain cannot be more than 50 characters']
        },
        logo : {
            type : String,
            default : ''
        },
        contactEmail : {
            type : String,
            default : '',
            match : [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
        },
        contactPhone : {
            type : String,
            default : '',
            match : [/^[0-9+\-() ]+$/, 'Please fill a valid phone number']
        },
        address : {
            type : String,
            default : '',
            maxLength : [150, 'Address cannot be more than 150 characters']
        },
        website : {
            type : String,
            default : '',
            match : [/^(https?:\/\/)?([\da-z.-]+)\.([a-z\.]{2,6})([\/\w .-]*)*\/?$/, 'Please fill a valid URL']
        },
        admissionSession : {
            type : String,
            default : '',
            trim : true
        },
        isActive: {
            type : Boolean,
            default : true
        }
    },
    {
        timestamps : true
    }
);

institutionSchema.index({ name: 1, subdomain: 1 }, { unique: true });

module.exports = mongoose.model('Institution', institutionSchema);
