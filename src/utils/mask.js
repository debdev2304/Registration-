'use strict';

function maskPhone(phone) {
	if (!phone) return '';
	const clean = String(phone).replace(/\D/g, '');
	if (clean.length < 4) return '*'.repeat(clean.length);
	return clean.slice(0, 2) + '******' + clean.slice(-2);
}

function maskAadhar(aadhar) {
	if (!aadhar) return '';
	const clean = String(aadhar).replace(/\D/g, '');
	if (clean.length <= 4) return clean;
	return 'XXXXXXXX' + clean.slice(-4);
}

module.exports = { maskPhone, maskAadhar };
