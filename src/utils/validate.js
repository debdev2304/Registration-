'use strict';

function isValidPhone(phone) {
	return /^\d{10}$/.test(String(phone || ''));
}

function isValidAadhar(aadhar) {
	return /^\d{12}$/.test(String(aadhar || ''));
}

module.exports = { isValidPhone, isValidAadhar };
