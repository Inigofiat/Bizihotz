// JavaScript Document



//Global variables
var languag = 'spanish';
var foodnam;
var enalpha = 0;
var refield = 'AB';
var transxsl1;
var transxml1;
var transxsl2;
var transxml2;
var order = new Array();
var loading = 0;
order[0] = 2;
order[1] = 0;
order[2] = 2;
order[3] = 2;
order[4] = 2;




function popUp(content) {
	var frog;
	if (languag == 'spanish')
		frog = window.open("", "Detalles", "width=400,height=600,location=no,scrollbars=yes,menubars=no,toolbars=no,resizable=yes");
	else if (languag == 'english')
		frog = window.open("", "Details", "width=400,height=600,location=no,scrollbars=yes,menubars=no,toolbars=no,resizable=yes");

	var content2 = content.replace(new RegExp("&amp;", "g"), "&");

	var html = "<html><head></head><body style=\"font-size:13px\" bgcolor=\"#A5D6A3\">" + content2;
	html += "<p style=\"font-size:14px\" align=\"center\"><a href=\"javascript:void(0)\" OnClick=\"window.close()\">Cerrar</a></p></body></html>"

	//variable name of window must be included for all three of the following methods so that
	//javascript knows not to write the string to this window, but instead to the new window

	frog.document.open();
	frog.document.write(html);
	frog.document.close();

}

function newXMLHttpRequest() {
	var xmlreq = false;
	if (window.XMLHttpRequest) {
		xmlreq = new XMLHttpRequest();
	} else if (window.ActiveXObject) {
		// Try ActiveX
		try {
			xmlreq = new ActiveXObject("Msxml2.XMLHTTP");
		} catch (e1) {
			// first method failed 
			try {
				xmlreq = new ActiveXObject("Microsoft.XMLHTTP");
			} catch (e2) {
				// both methods failed 
			}
		}
	}
	return xmlreq;
}

function emptyform(form) {
	if (document.getElementById(refield) != null) {
		document.getElementById(refield).style.display = 'none';
		document.getElementById('AB').style.display = 'block';
		refield = 'AB';
	}
	document.getElementById(form).reset();
}










function publicationtypelistquery() {
	query("3a", new Array('pt_id', 'pt_descripcion', 'pt_description'), new Array(), new Array(), new Array(), new Array(), 'pt_id', 'ASC');
}

function adquisitiontypelistquery() {
	query("3b", new Array('at_id', 'at_descripcion', 'at_description'), new Array(), new Array(), new Array(), new Array(), 'at_id', 'ASC');
}

function foodgrouplistquery() {
	query(3, new Array('fg_id', 'fg_ori_name', 'fg_eng_name'), new Array(), new Array(), new Array(), new Array(), 'fg_id', 'ASC');
}

function foodgrouplistquery2() {
	query("3t", new Array('fg_id', 'fg_ori_name', 'fg_eng_name'), new Array(), new Array(), new Array(), new Array(), 'fg_id', 'ASC');
}

function componentgrouplistquery() {
	query("3g", new Array('cg_id', 'cg_descripcion', 'cg_description'), new Array(), new Array(), new Array(), new Array(), 'cg_id', 'ASC');
}

function componentlistquery(grupo) {
	query("3h", new Array('cg_id', 'c_id', 'c_ori_name', 'c_eng_name', 'eur_name', 'c_com_esp', 'c_com_ing', 'glos_esp', 'glos_ing'), new Array('publico'), new Array('EQUAL'), new Array(), new Array('1'), 'cg_id', 'ASC');
}

function componentlistquery2(food) {
	query("3s", new Array('f_id', 'v_comp_id', 'c_id', 'c_ori_name', 'c_eng_name', 'eur_name', 'c_com_esp', 'c_com_ing'), new Array('v_food_id'), new Array('EQUAL'), new Array(), new Array(food), 'c_ori_name', 'ASC');
}

function foodlistquery(grupo, origen) {
	query("3f", new Array('f_id', 'f_ori_name', 'f_eng_name'), new Array('foodgroup_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(grupo, origen), 'f_ori_name', 'ASC');
}

function foodlistquery2(grupo, origen) {
	query("3r", new Array('v_food_id', 'f_id', 'f_ori_name', 'f_eng_name'), new Array('foodgroup_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(grupo, origen), 'f_ori_name', 'ASC');
}


function methodhdlinelistquery() {
	query("3c", new Array('mhd_id', 'mhd_descripcion', 'mhd_description', 'mhd_com_esp', 'mhd_com_ing'), new Array(), new Array(), new Array(), new Array(), 'mhd_descripcion', 'ASC');
}

function methodtypelistquery() {
	query("3d", new Array('mt_id', 'mt_descripcion', 'mt_description'), new Array(), new Array(), new Array(), new Array(), 'mt_id', 'ASC');
}

function referencelistquery() {
	query("3e", new Array('r_id', 'citation'), new Array("citation"), new Array('NOTEQUAL'), new Array(), new Array(null), 'r_id', 'ASC');
}

function methodlistquery(origen) {
	query("3i", new Array('m_id', 'mhd_descripcion', 'mt_descripcion', 'mhd_description', 'mt_description', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'pt_id', 'pt_descripcion', 'at_id', 'at_descripcion', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('m_origen'), new Array('EQUAL'), new Array(), new Array(origen), 'm_nom_esp', 'ASC');
}

function methodquery(id, origen) {
	if (origen == 'BEDCA') {
		if (languag == 'spanish')
			query("3i2", new Array('m_id', 'mhd_descripcion', 'mt_descripcion', 'mhd_description', 'mt_description', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'pt_id', 'pt_descripcion', 'at_id', 'at_descripcion', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('m_id'), new Array('EQUAL'), new Array(), new Array(id), 'm_id', 'ASC');
		else if (languag == 'english')
			query("3i2", new Array('m_id', 'mhd_descripcion', 'mt_descripcion', 'mhd_description', 'mt_description', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'pt_id', 'pt_descripcion', 'pt_description', 'at_id', 'at_descripcion', 'at_description', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('m_id'), new Array('EQUAL'), new Array(), new Array(id), 'm_id', 'ASC');
	}
	else {
		if (languag == 'spanish')
			query("3i2", new Array('m_id', 'mhd_descripcion', 'mt_descripcion', 'mhd_description', 'mt_description', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'pt_id', 'pt_descripcion', 'at_id', 'at_descripcion', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('m_id', 'm_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(id, origen), 'm_id', 'ASC');
		else if (languag == 'english')
			query("3i2", new Array('m_id', 'mhd_descripcion', 'mt_descripcion', 'mhd_description', 'mt_description', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'pt_id', 'pt_descripcion', 'pt_description', 'at_id', 'at_descripcion', 'at_description', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('m_id', 'm_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(id, origen), 'm_id', 'ASC');
	}
}

function valuetypelistquery() {
	query("3j", new Array('vt_id', 'vt_descripcion', 'vt_description'), new Array(), new Array(), new Array(), new Array(), 'vt_id', 'ASC');
}

function moexlistquery() {
	query("3k", new Array('mu_id', 'mu_descripcion', 'mu_description'), new Array(), new Array(), new Array(), new Array(), 'mu_id', 'ASC');
}

function unitlistquery() {
	query("3l", new Array('u_id', 'u_descripcion', 'u_description'), new Array(), new Array(), new Array(), new Array(), 'u_id', 'ASC');
}

function valuelistquery(food, component) {
	query("3m", new Array('v_food_id', 'v_comp_id', 'best_location', 'v_unit', 'value_type', 'moex', 'stdv', 'min', 'max', 'v_n', 'method_id', 'm_meth_type', 'm_meth_head', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'ref_id', 'pt_id', 'pt_descripcion', 'at_descripcion', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('v_food_id', 'v_comp_id'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(food, component), 'v_food_id', 'ASC');
}

function editfoodquery(food, origen) {
	query("3n", new Array('f_id', 'f_ori_name', 'f_eng_name', 'sci_name', 'langual', 'foodgroup_id', 'edible_portion', 'f_des_esp', 'f_des_ing', 'photo'), new Array('f_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(food, origen), null, null);
}

function editreferencequery(reference, origen) {
	query("3o", new Array('r_id', 'pub_type', 'adq_type', 'title', 'authors', 'pub_date', 'ori_lan', 'isbn', 'fed_dat', 'ednr', 'n_pages', 'bk_title', 'editors', 'pages', 'lgjr_name', 'abjr_name', 'issn', 'volume', 'issue', 'seri_name', 'rpr_title', 'valid', 'ref_com_esp', 'ref_com_ing', 'url', 'file_frmt', 'op_system', 'seri_num', 'pages'), new Array('r_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(reference, origen), null, null);
}

function editmethodquery(method, origen) {
	query("3p", new Array('m_id', 'm_meth_type', 'm_meth_head', 'm_nom_esp', 'm_nom_ing', 'm_descripcion', 'm_description', 'm_ref_id'), new Array('m_id', 'm_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(method, origen), null, null);
}

function editcompositionquery(food, component) {
	query("3q", new Array('v_food_id', 'v_comp_id', 'best_location', 'v_unit', 'value_type', 'moex', 'stdv', 'min', 'max', 'v_n', 'v_com_esp', 'v_com_ing', 'method_id', 'ref_id'), new Array('v_food_id', 'v_comp_id'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(food, component), null, null);
}

function deletefoodquery(food, origen) {
	query("6", new Array('f_id'), new Array('f_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(food, origen), null, null);
}

function deletemethodquery(method, origen) {
	query("6", new Array('m_id'), new Array('m_id', 'm_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(method, origen), null, null);
}

function deletereferencequery(reference, origen) {
	query("6", new Array('r_id'), new Array('r_id', 'ref_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(reference, origen), null, null);
}

function deletecompositionquery(food, component) {
	query("6", new Array('v_food_id'), new Array('v_food_id', 'v_comp_id'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(food, component), null, null);
}








function foodgroupbuildquery(form) {
	var type = form.fglist.value;

	document.getElementById("alphabet").style.display = 'none';

	document.getElementById('previous3').innerHTML = document.getElementById('content2').innerHTML;

	document.getElementById('content2').style.visibility = 'hidden';
	if (languag == 'spanish')
		query(1, new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'f_origen'), new Array('foodgroup_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(type, 'BEDCA'), 'f_eng_name', 'ASC');
	else if (languag == 'english')
		query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen'), new Array('foodgroup_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(type, 'BEDCA'), 'f_eng_name', 'ASC');
}

function namebuildquery(form) {
	var type = form.classname.value;
	var fname = form.foodname.value;

	document.getElementById("alphabet").style.display = 'none';

	document.getElementById('previous3').innerHTML = document.getElementById('content2').innerHTML;

	document.getElementById('content2').style.visibility = 'hidden';

	if (type == "spanish") {
		if (languag == 'spanish')
			query(1, new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'f_origen'), new Array('f_ori_name', 'f_origen'), new Array('LIKE', 'EQUAL'), new Array(), new Array(fname, 'BEDCA'), 'f_ori_name', 'ASC');
		else if (languag == 'english')
			query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen'), new Array('f_ori_name', 'f_origen'), new Array('LIKE', 'EQUAL'), new Array(), new Array(fname, 'BEDCA'), 'f_eng_name', 'ASC');
	}
	if (type == "english") {
		if (languag == 'spanish')
			query(1, new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'f_origen'), new Array('f_eng_name', 'f_origen'), new Array('LIKE', 'EQUAL'), new Array(), new Array(fname, 'BEDCA'), 'f_eng_name', 'ASC');
		else if (languag == 'english')
			query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen'), new Array('f_eng_name', 'f_origen'), new Array('LIKE', 'EQUAL'), new Array(), new Array(fname, 'BEDCA'), 'f_eng_name', 'ASC');
	}
	if (type == "sciname") {
		if (languag == 'spanish')
			query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen'), new Array('sci_name', 'f_origen'), new Array('LIKE', 'EQUAL'), new Array(), new Array(fname, 'BEDCA'), 'sci_name', 'ASC');
		else if (languag == 'english')
			query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen'), new Array('sci_name', 'f_origen'), new Array('LIKE', 'EQUAL'), new Array(), new Array(fname, 'BEDCA'), 'sci_name', 'ASC');
	}
}

function alphabuildquery(letter) {
	document.getElementById('content2').style.visibility = 'hidden';

	if (letter == 'all') {
		if (languag == 'spanish')
			query(1, new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'f_origen', 'edible_portion'), new Array('f_origen'), new Array('EQUAL'), new Array(), new Array('BEDCA'), 'f_ori_name', 'ASC');
		else if (languag == 'english')
			query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen', 'edible_portion'), new Array('f_origen'), new Array('EQUAL'), new Array(), new Array('BEDCA'), 'f_eng_name', 'ASC');
	}
	else {
		if (letter == 'other') {
			if (languag == 'spanish')
				query(1, new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'f_origen', 'edible_portion'), new Array('f_ori_name', 'f_origen'), new Array('NOTPATTERN', 'EQUAL'), new Array(), new Array('^[a-z]', 'BEDCA'), 'f_ori_name', 'ASC');
			else if (languag == 'english')
				query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen', 'edible_portion'), new Array('f_eng_name', 'f_origen'), new Array('NOTPATTERN', 'EQUAL'), new Array(), new Array('^[a-z]', 'BEDCA'), 'f_eng_name', 'ASC');
		}
		else {
			if (languag == 'spanish')
				query(1, new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'f_origen', 'edible_portion'), new Array('f_ori_name', 'f_origen'), new Array('BEGINW', 'EQUAL'), new Array(), new Array(letter, 'BEDCA'), 'f_ori_name', 'ASC');
			else if (languag == 'english')
				query(1, new Array('f_id', 'langual', 'f_eng_name', 'f_origen', 'edible_portion'), new Array('f_eng_name', 'f_origen'), new Array('BEGINW', 'EQUAL'), new Array(), new Array(letter, 'BEDCA'), 'f_eng_name', 'ASC');
		}
	}
}

function componentbuildquery(form) {
	order[0] = 2;
	order[1] = 2;
	order[2] = 2;
	order[3] = 2;
	order[4] = 0;

	var component = form.clist.value;

	document.getElementById("alphabet").style.display = 'none';

	document.getElementById('previous3').innerHTML = document.getElementById('content2').innerHTML;

	document.getElementById('content2').style.visibility = 'hidden';

	if (languag == 'spanish')
		query("1a", new Array('f_id', 'f_ori_name', 'langual', 'f_eng_name', 'c_ori_name', 'best_location', 'v_unit', 'moex', 'f_origen'), new Array('c_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(component, 'BEDCA'), 'best_location', 'DESC');
	else if (languag == 'english')
		query("1a", new Array('f_id', 'langual', 'f_eng_name', 'c_eng_name', 'best_location', 'v_unit', 'moex', 'f_origen'), new Array('c_id', 'f_origen'), new Array('EQUAL', 'EQUAL'), new Array(), new Array(component, 'BEDCA'), 'best_location', 'DESC');
}























function query(level, selection, cond1, relation, cond2, cond3, order, ordertype) {
	loading = 1;
	var xmlDoc;
	var x;
	var newel;
	var newtext;
	var newatt;

	xmlDoc = loadXMLDoc();

	x = xmlDoc.getElementsByTagName('foodquery');
	newel = xmlDoc.createElement('type');
	x[0].appendChild(newel);

	x = xmlDoc.getElementsByTagName('type');
	newatt = xmlDoc.createAttribute('level');
	newatt.value = level;
	x[0].setAttributeNode(newatt);

	if (selection.length <= 0) {
		loading = 0;
		return -1;
	}
	if (level != 4 && level != 5 && level != 6) {
		x = xmlDoc.getElementsByTagName('foodquery');
		newel = xmlDoc.createElement('selection');
		x[0].appendChild(newel);

		var i = 0;

		for (i = 0; i < selection.length; i++) {
			x = xmlDoc.getElementsByTagName('selection');
			newel = xmlDoc.createElement('atribute');
			x[0].appendChild(newel);

			x = xmlDoc.getElementsByTagName('atribute');
			newatt = xmlDoc.createAttribute('name');
			newatt.value = selection[i];
			x[i].setAttributeNode(newatt);
		}

		i = 0;

		if (cond1.length != relation.length || cond1.length != (cond2.length + cond3.length)) {
			loading = 0;
			return -1;
		}
		if (cond1.length > 0 && relation.length > 0 && (cond2.length + cond3.length) > 0) {
			for (i = 0; i < cond1.length; i++) {
				x = xmlDoc.getElementsByTagName('foodquery');
				newel = xmlDoc.createElement('condition');
				x[0].appendChild(newel);

				x = xmlDoc.getElementsByTagName('condition');
				newel = xmlDoc.createElement('cond1');
				x[i].appendChild(newel);

				x = xmlDoc.getElementsByTagName('cond1');
				newel = xmlDoc.createElement('atribute1');
				x[i].appendChild(newel);

				x = xmlDoc.getElementsByTagName('atribute1');
				newatt = xmlDoc.createAttribute('name');
				newatt.value = cond1[i];
				x[i].setAttributeNode(newatt);

				x = xmlDoc.getElementsByTagName('condition');
				newel = xmlDoc.createElement('relation');
				x[i].appendChild(newel);

				x = xmlDoc.getElementsByTagName('relation');
				newatt = xmlDoc.createAttribute('type');
				newatt.value = relation[i];
				x[i].setAttributeNode(newatt);

				if (cond2[i] != '') {
					x = xmlDoc.getElementsByTagName('condition');
					newel = xmlDoc.createElement('cond3');
					newtext = xmlDoc.createTextNode(cond3[i]);
					newel.appendChild(newtext);
					x[i].appendChild(newel);
				}
				else {
					x = xmlDoc.getElementsByTagName('condition');
					newel = xmlDoc.createElement('cond2');
					x[i].appendChild(newel);

					x = xmlDoc.getElementsByTagName('cond2');
					newel = xmlDoc.createElement('atribute2');
					x[i].appendChild(newel);

					x = xmlDoc.getElementsByTagName('atribute2');
					newatt = xmlDoc.createAttribute('name');
					newatt.value = cond2[i];
					x[i].setAttributeNode(newatt);
				}
			}
		}

		if (order != null && ordertype != null) {
			x = xmlDoc.getElementsByTagName('foodquery');
			newel = xmlDoc.createElement('order');
			x[0].appendChild(newel);

			x = xmlDoc.getElementsByTagName('order');
			newatt = xmlDoc.createAttribute('ordtype');
			newatt.value = ordertype;
			x[0].setAttributeNode(newatt);

			x = xmlDoc.getElementsByTagName('order');
			newel = xmlDoc.createElement('atribute3');
			x[0].appendChild(newel);

			x = xmlDoc.getElementsByTagName('atribute3');
			newatt = xmlDoc.createAttribute('name');
			newatt.value = order;
			x[0].setAttributeNode(newatt);
		}
	}
	else {
		x = xmlDoc.getElementsByTagName('foodquery');
		newel = xmlDoc.createElement('insertion');
		x[0].appendChild(newel);

		i = 0;

		for (i = 0; i < selection.length; i++) {
			if (i % 2 == 0) {
				x = xmlDoc.getElementsByTagName('insertion');
				newel = xmlDoc.createElement('column');
				x[0].appendChild(newel);

				x = xmlDoc.getElementsByTagName('column');
				newatt = xmlDoc.createAttribute('name');
				newatt.value = selection[i];
				x[i / 2].setAttributeNode(newatt);
			}
			else {
				x = xmlDoc.getElementsByTagName('insertion');
				newel = xmlDoc.createElement('value');
				newtext = xmlDoc.createTextNode(selection[i]);
				if (isValidNumber(selection[i])) {
					newtext.data = newtext.data.replace(/,/, ".")
				}
				newel.appendChild(newtext);
				x[0].appendChild(newel);
			}
		}

		i = 0;

		if (cond1.length != relation.length || cond1.length != (cond2.length + cond3.length)) {
			loading = 0;
			return -1;
		}
		if (cond1.length > 0 && relation.length > 0 && (cond2.length + cond3.length) > 0) {
			for (i = 0; i < cond1.length; i++) {
				x = xmlDoc.getElementsByTagName('foodquery');
				newel = xmlDoc.createElement('condition');
				x[0].appendChild(newel);

				x = xmlDoc.getElementsByTagName('condition');
				newel = xmlDoc.createElement('cond1');
				x[i].appendChild(newel);

				x = xmlDoc.getElementsByTagName('cond1');
				newel = xmlDoc.createElement('atribute1');
				x[i].appendChild(newel);

				x = xmlDoc.getElementsByTagName('atribute1');
				newatt = xmlDoc.createAttribute('name');
				newatt.value = cond1[i];
				x[i].setAttributeNode(newatt);

				x = xmlDoc.getElementsByTagName('condition');
				newel = xmlDoc.createElement('relation');
				x[i].appendChild(newel);

				x = xmlDoc.getElementsByTagName('relation');
				newatt = xmlDoc.createAttribute('type');
				newatt.value = relation[i];
				x[i].setAttributeNode(newatt);

				if (cond2[i] != '') {
					x = xmlDoc.getElementsByTagName('condition');
					newel = xmlDoc.createElement('cond3');
					newtext = xmlDoc.createTextNode(cond3[i]);
					newel.appendChild(newtext);
					x[i].appendChild(newel);
				}
				else {
					x = xmlDoc.getElementsByTagName('condition');
					newel = xmlDoc.createElement('cond2');
					x[i].appendChild(newel);

					x = xmlDoc.getElementsByTagName('cond2');
					newel = xmlDoc.createElement('atribute2');
					x[i].appendChild(newel);

					x = xmlDoc.getElementsByTagName('atribute2');
					newatt = xmlDoc.createAttribute('name');
					newatt.value = cond2[i];
					x[i].setAttributeNode(newatt);
				}
			}
		}
	}

	if (level == 1) {
		if (languag == 'spanish')
			var style = 'foodresponse1.xsl';
		else if (languag == 'english')
			var style = 'foodresponse1_en.xsl';
	}
	if (level == "1a") {
		if (languag == 'spanish')
			var style = 'foodresponse1a.xsl';
		else if (languag == 'english')
			var style = 'foodresponse1a_en.xsl';
	}
	if (level == "1b") {
		if (languag == 'spanish')
			var style = 'foodresponse1b.xsl';
		else if (languag == 'english')
			var style = 'foodresponse1b_en.xsl';
	}
	if (level == 2) {
		if (window.ActiveXObject) {
			if (languag == 'spanish')
				var style = 'foodresponse2ie.xsl';
			else if (languag == 'english')
				var style = 'foodresponse2ie_en.xsl';
		}
		else {
			if (languag == 'spanish')
				var style = 'foodresponse2.xsl';
			else if (languag == 'english')
				var style = 'foodresponse2_en.xsl';
		}
	}
	if (level == '2a') {
		if (window.ActiveXObject) {
			if (languag == 'spanish')
				var style = 'foodresponse2aie.xsl';
			else if (languag == 'english')
				var style = 'foodresponse2aie_en.xsl';
		}
		else {
			if (languag == 'spanish')
				var style = 'foodresponse2a.xsl';
			else if (languag == 'english')
				var style = 'foodresponse2a_en.xsl';
		}
	}
	if (level == 3) {
		if (languag == 'spanish')
			var style = 'foodgrouplistresponse.xsl';
		else if (languag == 'english')
			var style = 'foodgrouplistresponse_en.xsl';
	}
	if (level == "3a")
		var style = 'publicationtypelistresponse.xsl';
	if (level == "3b")
		var style = 'adquisitiontypelistresponse.xsl';
	if (level == "3c")
		var style = 'methodhdlinelistresponse.xsl';
	if (level == "3d")
		var style = 'methodtypelistresponse.xsl';
	if (level == "3e") {
		if (languag == 'spanish')
			var style = 'referencelistresponse.xsl';
		else if (languag == 'english')
			var style = 'referencelistresponse_en.xsl';
	}
	if (level == "3f")
		var style = 'foodlistresponse.xsl';
	if (level == "3g") {
		if (languag == 'spanish')
			var style = 'componentgrouplistresponse.xsl';
		else if (languag == 'english')
			var style = 'componentgrouplistresponse_en.xsl';
	}
	if (level == "3h") {
		if (languag == 'spanish')
			var style = 'componentlistresponse.xsl';
		else if (languag == 'english')
			var style = 'componentlistresponse_en.xsl';
	}
	if (level == "3i")
		var style = 'methodlistresponse.xsl';
	if (level == "3i2") {
		if (languag == 'spanish')
			var style = 'methodresponse.xsl';
		else if (languag == 'english')
			var style = 'methodresponse_en.xsl';
	}
	if (level == "3j")
		var style = 'valuetypelistresponse.xsl';
	if (level == "3k")
		var style = 'moexlistresponse.xsl';
	if (level == "3l") {
		if (languag == 'spanish')
			var style = 'unitlistresponse.xsl';
		else if (languag == 'english')
			var style = 'unitlistresponse_en.xsl';
	}
	if (level == "3m")
		var style = 'valuelistresponse.xsl';
	if (level == "3n")
		var style = 'editfoodresponse.xsl';
	if (level == "3o")
		var style = 'editreferenceresponse.xsl';
	if (level == "3p")
		var style = 'editmethodresponse.xsl';
	if (level == "3q")
		var style = 'editcompositionresponse.xsl';
	if (level == "3r")
		var style = 'foodlistresponse2.xsl';
	if (level == "3s")
		var style = 'componentlistresponse2.xsl';
	if (level == "3t")
		var style = 'foodgrouplistresponse2.xsl';
	if (level == "3u")
		var style = '';

	var i = 0;
	if (level == 1 || level == "1a" || level == "1b") {
		if (languag == 'spanish')
			document.getElementById('content2').innerHTML = '<p><a href="javascript:void(0)" class="button" id="Todos" onclick="compiling = 0;comparray = new Array();comparrayid = new Array();scroll(0,0);if (enalpha == 1) document.getElementById(\'alphabet\').style.display = \'block\';document.getElementById(\'content2\').innerHTML = document.getElementById(\'previous3\').innerHTML;"><span>Consulta anterior</span></a></p>' + '<h2 align="center">Listado de alimentos de la consulta</h2><h2><br /><br /></h2>';

		else if (languag == 'english')
			document.getElementById('content2').innerHTML = '<p><a href="javascript:void(0)" class="button" id="Todos" onclick="compiling = 0;comparray = new Array();comparrayid = new Array();scroll(0,0);if (enalpha == 1) document.getElementById(\'alphabet\').style.display = \'block\';document.getElementById(\'content2\').innerHTML = document.getElementById(\'previous3\').innerHTML;"><span>Previous query</span></a></p>' + '<h2 align="center">Food list</h2><h2><br /><br /></h2>';

		ajaxcom(level, 'procquery.php', 'content2', xmlDoc, style);
	}
	else if (level == 2 || level == '2a') {
		document.getElementById('content2').innerHTML = '';
		ajaxcom(level, 'procquery.php', 'content2', xmlDoc, style);
	}
	if (level == 3 || level == "3t")
		ajaxcom(level, 'procquery.php', 'foodgrouplist', xmlDoc, style);
	if (level == "3a")
		ajaxcom(level, 'procquery.php', 'publicationtypelist', xmlDoc, style);
	if (level == "3b")
		ajaxcom(level, 'procquery.php', 'adquisitiontypelist', xmlDoc, style);
	if (level == "3c")
		ajaxcom(level, 'procquery.php', 'methodhdlinelist', xmlDoc, style);
	if (level == "3d")
		ajaxcom(level, 'procquery.php', 'methodtypelist', xmlDoc, style);
	if (level == "3e") {
		document.getElementById("tm").innerHTML = '<h1><a href="/">P&aacute;gina principal </a>&raquo; Blibliograf&iacute;a </h1>';
		ajaxcom(level, 'procquery.php', 'content2', xmlDoc, style);
	}
	if (level == "3f" || level == "3r")
		ajaxcom(level, 'procquery.php', 'foodlist', xmlDoc, style);
	if (level == "3g")
		ajaxcom(level, 'procquery.php', 'componentgrouplist', xmlDoc, style);
	if (level == "3h" || level == "3s")
		ajaxcom(level, 'procquery.php', 'componentlist', xmlDoc, style);
	if (level == "3i")
		ajaxcom(level, 'procquery.php', 'methodlist', xmlDoc, style);
	if (level == "3i2")
		ajaxcom(level, 'procquery.php', '', xmlDoc, style);
	if (level == "3j")
		ajaxcom(level, 'procquery.php', 'valuetypelist', xmlDoc, style);
	if (level == "3k")
		ajaxcom(level, 'procquery.php', 'moexlist', xmlDoc, style);
	if (level == "3l")
		ajaxcom(level, 'procquery.php', 'unitlist', xmlDoc, style);
	if (level == "3m")
		ajaxcom(level, 'procquery.php', 'valuelist', xmlDoc, style);
	if (level == "3n" || level == "3o" || level == "3p" || level == "3q")
		ajaxcom(level, 'procquery.php', 'editionform', xmlDoc, style);
	if (level == 4 || level == 5 || level == 6)
		ajaxcom(level, 'procquery.php', 'contentlist', xmlDoc, style);

	function loadXMLDoc() {
		var foodquery = '<?xml version="1.0" encoding="utf-8"?><foodquery></foodquery>';

		var xmlDoc;
		// code for IE
		if (window.ActiveXObject) {
			xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
			xmlDoc.async = "false";
			xmlDoc.loadXML(foodquery);
		}
		// code for Mozilla, Firefox, Opera, etc.
		else if (document.implementation && document.implementation.createDocument) {
			var parser = new DOMParser();
			xmlDoc = parser.parseFromString(foodquery, "text/xml");
		}
		else {
			alert('Tu navegador no soporta este script');
		}
		return (xmlDoc);
	}
	function ajaxcom(level, url, container, xmldoc, stylesheet) {
		if (window.ActiveXObject) {
			var xmlString = xmlDoc.xml;
		}

		else if (document.implementation && document.implementation.createDocument) {
			var xmlString = (new XMLSerializer()).serializeToString(xmlDoc);

			//alert(xmlString);
			if (level != 4 && level != 5 && level != 6) {
				var xsltProcessor = new XSLTProcessor();

				// Load the xsl file using synchronous (third param is set to false) XMLHttpRequest
				var myXMLHTTPRequest = new XMLHttpRequest();
				myXMLHTTPRequest.open("GET", stylesheet, false);
				myXMLHTTPRequest.send(null);

				var xslRef = myXMLHTTPRequest.responseXML;

				// Finally import the .xsl
				xsltProcessor.importStylesheet(xslRef);
				if (level == 1 || level == '1a' || level == '1b')
					transxsl1 = xsltProcessor;
				else if (level == 2 || level == '2a')
					transxsl2 = xsltProcessor;
			}
		}

		var xmlHttp = newXMLHttpRequest();

		// Open a connection to the server
		xmlHttp.open("POST", url, true);

		// Tell the server you're sending it XML
		xmlHttp.setRequestHeader("Content-Type", "text/xml");

		// Set up a function for the server to run when it's done
		xmlHttp.onreadystatechange = function () {
			if (xmlHttp.readyState == 4) {
				if (xmlHttp.status == 200) {
					if (document.implementation && document.implementation.createDocument) {
						if (level != 4 && level != 5 && level != 6) {
							if (level != "3i2")
								document.getElementById(container).style.visibility = 'hidden';
							//if (level == "3h")
							//	popUp(xmlHttp.responseText);
							if (xmlHttp.responseText.substring(0, 7) == "error: ") {
								alert(xmlHttp.responseText);
								//popUp(xmlHttp.responseText);
								loading = 0;
								return -1;
							}
							if (level == 1 || level == '1a' || level == '1b')
								transxml1 = xmlHttp.responseXML;
							else if (level == 2 || level == '2a')
								transxml2 = xmlHttp.responseXML;

							if (level == '1') {
								xsltProcessor.setParameter(null, "orderf", "f_ori_name");
								xsltProcessor.setParameter(null, "ascdescf", "ascending");
								xsltProcessor.setParameter(null, "typef", "text");
							}
							if (level == '1a') {
								xsltProcessor.setParameter(null, "orderf", "best_location");
								xsltProcessor.setParameter(null, "ascdescf", "descending");
								xsltProcessor.setParameter(null, "typef", "number");
							}
							if (level == '1b') {
								xsltProcessor.setParameter(null, "orderf", "f_ori_name");
								xsltProcessor.setParameter(null, "ascdescf", "ascending");
								xsltProcessor.setParameter(null, "typef", "text");
							}
							if (level == '2')
								xsltProcessor.setParameter(null, "factorc", 100);

							var fragment = xsltProcessor.transformToFragment(xmlHttp.responseXML, document);

							if (level != 3 && level != "3a" && level != "3b" && level != "3c" && level != "3d" && level != "3e" && level != "3f" && level != "3g" && level != "3h" && level != "3i" && level != "3j" && level != "3k" && level != "3l" && level != "3m" && level != "3n" && level != "3o" && level != "3p" && level != "3q" && level != "3r" && level != "3s" && level != "3t" && level != "3u" && level != "3i2") {
								document.getElementById(container).innerHTML = document.getElementById(container).innerHTML + ((new XMLSerializer()).serializeToString(fragment));
							}
							else {
								if (level == "3i2") {
									var content = ((new XMLSerializer()).serializeToString(fragment));
									var contfinal = content.replace(new RegExp("&amp;", "g"), "&");
									if (languag == 'spanish')
										slc(contfinal, 'informaci&oacute;n del m&eacute;todo BEDCA');
									else if (languag == 'english')
										slc(contfinal, 'BEDCA method information');

								}
								else {
									document.getElementById(container).innerHTML = ((new XMLSerializer()).serializeToString(fragment));
									if (level == "3r")
										eval("componentlistquery2(document.getElementById('flist').value)");
									if (level == "3t")
										eval("foodlistquery2(document.getElementById('fglist').value,document.getElementById('origen').value)");
									if (level == "3n")
										document.getElementById('editionform').style.display = 'block';
									if (level == "3o") {
										var ori_lan = document.getElementById('ori_lane').innerHTML;
										var terminar = true;
										var i = 0;
										for (i; i < document.getElementById('ori_lan').length && terminar; i++)
											if (document.getElementById('ori_lan').options[i].value == ori_lan) {
												document.getElementById('ori_lan').selectedIndex = i;
												terminar = false;

											}

										var pub_type = document.getElementById('pub_type').innerHTML;


										terminar = true;
										i = 0;

										var adq_type = document.getElementById('adq_type').innerHTML;

										for (i; i < document.getElementById('atlist').length && terminar; i++)
											if (document.getElementById('atlist').options[i].value == adq_type) {
												document.getElementById('atlist').selectedIndex = i;
												terminar = false;
											}

										document.getElementById('editionform').style.display = 'block';

										document.getElementById(pub_type).style.display = 'block';
									}
									if (level == "3p") {
										var m_meth_type = document.getElementById('m_meth_type').innerHTML;
										var m_meth_head = document.getElementById('m_meth_head').innerHTML;
										var m_ref_id = document.getElementById('m_ref_id').innerHTML;
										var i = 0;

										var terminar = true;

										for (i; i < document.getElementById('mtypelist').length && terminar; i++)
											if (document.getElementById('mtypelist').options[i].value == m_meth_type) {
												document.getElementById('mtypelist').selectedIndex = i;
												terminar = false;

											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('mhdlinelist').length && terminar; i++)
											if (document.getElementById('mhdlinelist').options[i].value == m_meth_head) {
												document.getElementById('mhdlinelist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('reflist').length && terminar; i++)
											if (document.getElementById('reflist').options[i].value == m_ref_id) {
												document.getElementById('reflist').selectedIndex = i;
												terminar = false;
											}

										if (m_meth_type == 'X') {
											document.getElementById('referencelist').style.display = 'none';
											document.getElementById('methodhdlinelist').style.display = 'none';
										}

										document.getElementById('editionform').style.display = 'block';
									}
									if (level == "3q") {
										var v_unit = document.getElementById('v_unit').innerHTML;
										var value_type = document.getElementById('value_type').innerHTML;
										var moex = document.getElementById('moex').innerHTML;
										var method_id = document.getElementById('method_id').innerHTML;
										var ref_id = document.getElementById('ref_id').innerHTML;
										var i = 0;
										var terminar = true;

										for (i; i < document.getElementById('ulist').length && terminar; i++)
											if (document.getElementById('ulist').options[i].value == v_unit) {
												document.getElementById('ulist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('vtlist').length && terminar; i++)
											if (document.getElementById('vtlist').options[i].value == value_type) {
												document.getElementById('vtlist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('mxlist').length && terminar; i++)
											if (document.getElementById('mxlist').options[i].value == moex) {
												document.getElementById('mxlist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('melist').length && terminar; i++)
											if (document.getElementById('melist').options[i].value == method_id) {
												document.getElementById('melist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('reflist').length && terminar; i++)
											if (document.getElementById('reflist').options[i].value == ref_id) {
												document.getElementById('reflist').selectedIndex = i;
												terminar = false;
											}

										document.getElementById('editionform').style.display = 'block';
									}
								}
							}
							if (level != "3i2")
								var myFx = new Fx.Style(container, 'opacity', { duration: 800 }).start(0, 1);
							if (level == 2 || level == 1 || level == "1a" || level == '1b' || level == '2a')
								if (document.getElementById('foodname') != null)
									foodnam = document.getElementById('foodname').innerHTML;
						}
						else {
							//alert(xmlHttp.responseText);
							if (xmlHttp.responseText.substring(0, 2) != 'OK') {
								alert(xmlHttp.responseText);
								loading = 0;
								return -1;
							}
							if (level == 6) {
								alert("El borrado se ha realizado correctamente");
							}
							else // parte de compilaci�n
							{
								if (compiling == 0) {
									document.getElementById("inresult").innerHTML = document.getElementById("insertmain").value;
									document.getElementById("results").style.display = 'block';
									if (level == 5)
										eval(document.getElementById('eval').innerHTML);
								}
								else {
									if (globalcompilingindex < comparrayid.length) {
										if (globalcompilingindex == 0) {
											var returnfid = xmlHttp.responseText.substring(2);
											var i = 0;
											for (i; i < comparrayid.length; i++) {
												comparray[comparrayid[i]] = "query(4,new Array('v_food_id','" + returnfid + "'," + comparray[comparrayid[i]];
											}
										}
										globalcompilingindex++;
										eval(comparray[comparrayid[globalcompilingindex - 1]]);
									}
									else {
										globalcompilingindex = 0;
										comparray = new Array();
										comparrayid = new Array();
										document.getElementById('compilingstate').innerHTML = document.getElementById('compilingstate').innerHTML + '<p>El alimento ha sido creado correctamente</p>';
									}
								}
							}
						}
					}
					else if (window.ActiveXObject) {
						if (level != 4 && level != 5 && level != 6) {
							if (level != "3i2")
								document.getElementById(container).style.visibility = 'hidden';
							if (xmlHttp.responseText.substring(0, 7) == 'error: ') {
								alert(xmlHttp.responseText);
								loading = 0;
								return -1;
							}
							var xml = new ActiveXObject("MSXML2.FreeThreadedDOMDocument");

							xml.async = false;
							xml.loadXML(xmlHttp.responseText);
							var xsl = new ActiveXObject("MSXML2.FreeThreadedDOMDocument");

							xsl.async = false;
							xsl.load(stylesheet);

							var XSLTCompiled = new ActiveXObject("MSXML2.XSLTemplate");
							XSLTCompiled.stylesheet = xsl.documentElement;
							var XSLTProcessor = XSLTCompiled.createProcessor();
							XSLTProcessor.input = xml;
							if (level == '1' || level == '1a' || level == '1b') {
								transxml1 = xml;
								transxsl1 = XSLTProcessor;
							}
							else if (level == '2' || level == '2a') {
								transxml2 = xml;
								transxsl2 = XSLTProcessor;
							}
							if (level != "3i2")
								var html = document.getElementById(container).innerHTML;
							if (level != 3 && level != "3a" && level != "3b" && level != "3c" && level != "3d" && level != "3e" && level != "3f" && level != "3g" && level != "3h" && level != "3i" && level != "3j" && level != "3k" && level != "3l" && level != "3m" && level != "3n" && level != "3o" && level != "3p" && level != "3q" && level != "3r" && level != "3s" && level != "3t" && level != "3u" && level != "3i2") {
								if (level == '1') {
									XSLTProcessor.addParameter("ordef", "f_ori_name");
									XSLTProcessor.addParameter("ascdescf", "ascending");
									XSLTProcessor.addParameter("typef", "text");
								}
								if (level == '1a') {
									XSLTProcessor.addParameter("orderf", "best_location");
									XSLTProcessor.addParameter("ascdescf", "descending");
									XSLTProcessor.addParameter("typef", "number");
								}
								if (level == '1b') {
									XSLTProcessor.addParameter("ordef", "f_ori_name");
									XSLTProcessor.addParameter("ascdescf", "ascending");
									XSLTProcessor.addParameter("typef", "text");
								}
								if (level == '2')
									XSLTProcessor.addParameter("factorc", 100);

								XSLTProcessor.transform();

								document.getElementById(container).innerHTML = document.getElementById(container).innerHTML + XSLTProcessor.output;
							}
							else {
								if (level == "3i2") {
									var content = (xml.transformNode(xsl));
									var contfinal = content.replace(new RegExp("&amp;", "g"), "&");
									if (languag == 'spanish')
										slc(contfinal, 'informaci&oacute;n del m&eacute;todo BEDCA');
									else if (languag == 'english')
										slc(contfinal, 'BEDCA method information');
								}
								else {
									document.getElementById(container).innerHTML = xml.transformNode(xsl);
									if (level == "3r")
										eval("componentlistquery2(document.getElementById('flist').value)");
									if (level == "3t")
										eval("foodlistquery2(document.getElementById('fglist').value,document.getElementById('origen').value)");
									if (level == "3n")
										document.getElementById('editionform').style.display = 'block';
									if (level == "3p") {
										var m_meth_type = document.getElementById('m_meth_type').innerHTML;
										var m_meth_head = document.getElementById('m_meth_head').innerHTML;
										var m_ref_id = document.getElementById('m_ref_id').innerHTML;
										var i = 0;
										var terminar = true;

										for (i; i < document.getElementById('mtypelist').length && terminar; i++)
											if (document.getElementById('mtypelist').options[i].value == m_meth_type) {
												document.getElementById('mtypelist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('mhdlinelist').length && terminar; i++)

											if (document.getElementById('mhdlinelist').options[i].value == m_meth_head) {
												document.getElementById('mhdlinelist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('reflist').length && terminar; i++)
											if (document.getElementById('reflist').options[i].value == m_ref_id) {
												document.getElementById('reflist').selectedIndex = i;
												terminar = false;
											}

										if (m_meth_type == 'X') {
											document.getElementById('referencelist').style.display = 'none';
											document.getElementById('methodhdlinelist').style.display = 'none';
										}

										document.getElementById('editionform').style.display = 'block';
									}
									if (level == "3o") {
										var ori_lan = document.getElementById('ori_lane').innerHTML;
										var terminar = true;
										var i = 0;
										for (i; i < document.getElementById('ori_lan').length && terminar; i++)
											if (document.getElementById('ori_lan').options[i].value == ori_lan) {
												document.getElementById('ori_lan').selectedIndex = i;
												terminar = false;

											}

										var pub_type = document.getElementById('pub_type').innerHTML;


										terminar = true;
										i = 0;

										var adq_type = document.getElementById('adq_type').innerHTML;

										for (i; i < document.getElementById('atlist').length && terminar; i++)
											if (document.getElementById('atlist').options[i].value == adq_type) {
												document.getElementById('atlist').selectedIndex = i;
												terminar = false;
											}

										document.getElementById('editionform').style.display = 'block';

										document.getElementById(pub_type).style.display = 'block';
									}
									if (level == "3q") {
										var v_unit = document.getElementById('v_unit').innerHTML;
										var value_type = document.getElementById('value_type').innerHTML;
										var moex = document.getElementById('moex').innerHTML;
										var method_id = document.getElementById('method_id').innerHTML;
										var ref_id = document.getElementById('ref_id').innerHTML;
										var i = 0;
										var terminar = true;

										for (i; i < document.getElementById('ulist').length && terminar; i++)
											if (document.getElementById('ulist').options[i].value == v_unit) {
												document.getElementById('ulist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('vtlist').length && terminar; i++)
											if (document.getElementById('vtlist').options[i].value == value_type) {
												document.getElementById('vtlist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('mxlist').length && terminar; i++)
											if (document.getElementById('mxlist').options[i].value == moex) {
												document.getElementById('mxlist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('melist').length && terminar; i++)
											if (document.getElementById('melist').options[i].value == method_id) {
												document.getElementById('melist').selectedIndex = i;
												terminar = false;
											}

										i = 0;
										terminar = true;

										for (i; i < document.getElementById('reflist').length && terminar; i++)
											if (document.getElementById('reflist').options[i].value == ref_id) {
												document.getElementById('reflist').selectedIndex = i;
												terminar = false;
											}

										document.getElementById('editionform').style.display = 'block';
									}
								}
							}
							if (level != "3i2")
								var myFx = new Fx.Style(container, 'opacity', { duration: 800 }).start(0, 1);
							if (level == 2 || level == 1 || level == "1a" || level == '1b' || level == '2a')
								if (document.getElementById('foodname') != null)
									foodnam = document.getElementById('foodname').innerHTML;
						}
						else {
							//alert(xmlHttp.responseText);
							if (xmlHttp.responseText != 'OK') {
								alert(xmlHttp.responseText);
								loading = 0;
								return -1;
							}
							if (level == 6) {
								alert("El borrado se ha realizado correctamente");
							}
							else // parte de compilaci�n
							{
								if (compiling == 0) {
									document.getElementById("inresult").innerHTML = document.getElementById("insertmain").value;
									document.getElementById("results").style.display = 'block';
									if (level == 5)
										eval(document.getElementById('eval').innerHTML);
								}
								else {
									if (globalcompilingindex < comparrayid.length) {
										if (globalcompilingindex == 0) {
											var returnfid = xmlHttp.responseText.substring(2);
											var i = 0;
											for (i; i < comparrayid.length; i++) {
												comparray[comparrayid[i]] = "query(4,new Array('v_food_id','" + returnfid + "'," + comparray[comparrayid[i]];
											}
										}
										globalcompilingindex++;
										eval(comparray[comparrayid[globalcompilingindex - 1]]);
									}
									else {
										globalcompilingindex = 0;
										comparray = new Array();
										comparrayid = new Array();
										document.getElementById('compilingstate').innerHTML = document.getElementById('compilingstate').innerHTML + '<p>El alimento ha sido creado correctamente</p>';
									}
								}
							}
						}
					}
					if (level != 5 && level != "3r" && level != "3t")
						loading = 0;
				}
			}
		}

		// Send the request
		xmlHttp.send(xmlString);
	}
}

function orderfoodlist(param) {
	transxsl = transxsl1;
	transxml = transxml1;

	if (document.implementation && document.implementation.createDocument) {
		transxsl.setParameter(null, "orderf", param);
		if (param == 'f_id') {
			if (order[0] == 2 || order[0] == 1) {
				order[0] = 0;
				transxsl.setParameter(null, "ascdescf", 'ascending');
			}
			else {
				order[0] = 1;
				transxsl.setParameter(null, "ascdescf", 'descending');
			}
			transxsl.setParameter(null, "typef", 'number');
		}
		if (param == 'f_ori_name') {
			if (order[1] == 2 || order[1] == 1) {
				order[1] = 0;
				transxsl.setParameter(null, "ascdescf", 'ascending');
			}
			else {
				order[1] = 1;
				transxsl.setParameter(null, "ascdescf", 'descending');
			}
			transxsl.setParameter(null, "typef", 'text');
		}
		if (param == 'f_eng_name') {
			if (order[2] == 2 || order[2] == 1) {
				order[2] = 0;
				transxsl.setParameter(null, "ascdescf", 'ascending');
			}
			else {
				order[2] = 1;
				transxsl.setParameter(null, "ascdescf", 'descending');
			}
			transxsl.setParameter(null, "typef", 'text');
		}
		if (param == 'f_origen') {
			if (order[3] == 2 || order[3] == 1) {
				order[3] = 0;
				transxsl.setParameter(null, "ascdescf", 'ascending');
			}
			else {
				order[3] = 1;
				transxsl.setParameter(null, "ascdescf", 'descending');
			}
			transxsl.setParameter(null, "typef", 'text');
		}
		if (param == 'best_location') {
			if (order[4] == 2 || order[4] == 1) {
				order[4] = 0;
				transxsl.setParameter(null, "ascdescf", 'ascending');
			}
			else {
				order[4] = 1;
				transxsl.setParameter(null, "ascdescf", 'descending');
			}
			transxsl.setParameter(null, "typef", 'number');
		}
		var fragment = transxsl.transformToFragment(transxml, document);
		document.getElementById('content2').style.visibility = 'hidden';
		document.getElementById('content2').innerHTML = '<p><a href="javascript:void(0)" class="button" id="Todos" onclick="scroll(0,0);if (enalpha == 1) document.getElementById(\'alphabet\').style.display = \'block\';document.getElementById(\'content2\').innerHTML = document.getElementById(\'previous3\').innerHTML;"><span>Consulta anterior</span></a></p>' + '<h2 align="center">Listado de alimentos de la consulta</h2><h2><br /><br /></h2>';
		document.getElementById('content2').innerHTML = document.getElementById('content2').innerHTML + ((new XMLSerializer()).serializeToString(fragment));
	}



	else if (window.ActiveXObject) {
		transxsl.addParameter("orderf", param);
		if (param == 'f_id') {
			if (order[0] == 2 || order[0] == 1) {
				order[0] = 0;
				transxsl.addParameter("ascdescf", 'ascending');
			}
			else {
				order[0] = 1;
				transxsl.addParameter("ascdescf", 'descending');
			}
			transxsl.addParameter("typef", 'number');
		}
		if (param == 'f_ori_name') {
			if (order[1] == 2 || order[1] == 1) {
				order[1] = 0;
				transxsl.addParameter("ascdescf", 'ascending');
			}
			else {
				order[1] = 1;
				transxsl.addParameter("ascdescf", 'descending');
			}
			transxsl.addParameter("typef", 'text');
		}
		if (param == 'f_eng_name') {
			if (order[2] == 2 || order[2] == 1) {
				order[2] = 0;
				transxsl.addParameter("ascdescf", 'ascending');
			}
			else {
				order[2] = 1;
				transxsl.addParameter("ascdescf", 'descending');
			}
			transxsl.addParameter("typef", 'text');
		}
		if (param == 'f_origen') {
			if (order[3] == 2 || order[3] == 1) {
				order[3] = 0;
				transxsl.addParameter("ascdescf", 'ascending');
			}
			else {
				order[3] = 1;
				transxsl.addParameter("ascdescf", 'descending');
			}
			transxsl.addParameter("typef", 'text');
		}
		if (param == 'best_location') {
			if (order[4] == 2 || order[4] == 1) {
				order[4] = 0;
				transxsl.addParameter("ascdescf", 'ascending');
			}
			else {
				order[4] = 1;
				transxsl.addParameter("ascdescf", 'descending');
			}
			transxsl.addParameter("typef", 'number');
		}

		transxsl.transform();

		document.getElementById('content2').style.visibility = 'hidden';
		document.getElementById('content2').innerHTML = '<p><a href="javascript:void(0)" class="button" id="Todos" onclick="scroll(0,0);if (enalpha == 1) document.getElementById(\'alphabet\').style.display = \'block\';document.getElementById(\'content2\').innerHTML = document.getElementById(\'previous3\').innerHTML;"><span>Consulta anterior</span></a></p>' + '<h2 align="center">Listado de alimentos de la consulta</h2><h2><br /><br /></h2>';
		document.getElementById('content2').innerHTML = document.getElementById('content2').innerHTML + transxsl.output;

	}

	var myFx = new Fx.Style('content2', 'opacity', { duration: 800 }).start(0, 1);
}

function calccomp(value) {
	if (value == '')
		value = 100;

	if (document.implementation && document.implementation.createDocument) {
		transxsl2.setParameter(null, "factorc", value);
		var fragment = transxsl2.transformToFragment(transxml2, document);
		document.getElementById('content2').style.visibility = 'hidden';
		document.getElementById('content2').innerHTML = '';
		document.getElementById('content2').innerHTML = document.getElementById('content2').innerHTML + ((new XMLSerializer()).serializeToString(fragment));
	}
	else if (window.ActiveXObject) {
		transxsl2.addParameter("factorc", value);
		transxsl2.transform();
		document.getElementById('content2').style.visibility = 'hidden';
		document.getElementById('content2').innerHTML = '';
		document.getElementById('content2').innerHTML = document.getElementById('content2').innerHTML + transxsl2.output;
	}

	var myFx = new Fx.Style('content2', 'opacity', { duration: 800 }).start(0, 1);
}
