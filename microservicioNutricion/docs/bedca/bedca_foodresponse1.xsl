<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:param name="orderf" />
<xsl:param name="ascdescf" />
<xsl:param name="typef" />

<xsl:template match="/">
<TABLE align="center" id="querytable1">
            <TR>
        		<TH align="center"><a style="color:#FFFFFF" href="javascript:void(0)" onclick="orderfoodlist('f_id')">Id</a></TH>
				<TH><a style="color:#FFFFFF" href="javascript:void(0)" onclick="orderfoodlist('f_ori_name')">Nombre</a></TH>
                <TH><a style="color:#FFFFFF" href="javascript:void(0)" onclick="orderfoodlist('f_eng_name')">Name</a></TH>

      		</TR>

			<xsl:for-each select="foodresponse/food">
			<xsl:sort select="*[name(.)=$orderf]" order="{$ascdescf}" data-type="{$typef}" />
			<TR>
				<xsl:attribute name="class">
 			    	<xsl:if test="position() mod 2 = 1">row-a</xsl:if>
	  		    	<xsl:if test="position() mod 2 = 0">row-b</xsl:if>
				</xsl:attribute>
              	<TD align="center">
					<a href="javascript:void(0)"><xsl:attribute name="onClick">scroll(0,0);document.getElementById("alphabet").style.display = 'none';document.getElementById('previous2').innerHTML = document.getElementById('content2').innerHTML;query(2,new Array('f_id','f_ori_name','f_eng_name','sci_name','langual','foodexcode','mainlevelcode','codlevel1','namelevel1','codsublevel','codlevel2','namelevel2','f_des_esp','f_des_ing','photo','edible_portion','f_origen','c_id','c_ori_name','c_eng_name','eur_name','componentgroup_id','glos_esp','glos_ing','cg_descripcion','cg_description','best_location','v_unit','moex','stdv','min','max','v_n','u_id','u_descripcion','u_description','value_type','vt_descripcion','vt_description','mu_id','mu_descripcion','mu_description','ref_id','citation','at_descripcion','at_description','pt_descripcion','pt_description','method_id','mt_descripcion','mt_description','m_descripcion','m_description','m_nom_esp','m_nom_ing','mhd_descripcion','mhd_description'),new Array('f_id','publico'),new Array('EQUAL','EQUAL'),new Array(),new Array('<xsl:value-of select="f_id"/>',1),'componentgroup_id','ASC')</xsl:attribute><xsl:value-of select="f_id" /></a>
				</TD>
			  	<TD id="foodname">
					<a href="javascript:void(0)"><xsl:attribute name="onClick">scroll(0,0);document.getElementById("alphabet").style.display = 'none';document.getElementById('previous2').innerHTML = document.getElementById('content2').innerHTML;query(2,new Array('f_id','f_ori_name','f_eng_name','sci_name','langual','foodexcode','mainlevelcode','codlevel1','namelevel1','codsublevel','codlevel2','namelevel2','f_des_esp','f_des_ing','photo','edible_portion','f_origen','c_id','c_ori_name','c_eng_name','eur_name','componentgroup_id','glos_esp','glos_ing','cg_descripcion','cg_description','best_location','v_unit','moex','stdv','min','max','v_n','u_id','u_descripcion','u_description','value_type','vt_descripcion','vt_description','mu_id','mu_descripcion','mu_description','ref_id','citation','at_descripcion','at_description','pt_descripcion','pt_description','method_id','mt_descripcion','mt_description','m_descripcion','m_description','m_nom_esp','m_nom_ing','mhd_descripcion','mhd_description'),new Array('f_id','publico'),new Array('EQUAL','EQUAL'),new Array(),new Array('<xsl:value-of select="f_id"/>',1),'componentgroup_id','ASC')</xsl:attribute><xsl:value-of select="f_ori_name"/></a>
				</TD>
                <TD>
					<a href="javascript:void(0)"><xsl:attribute name="onClick">scroll(0,0);document.getElementById("alphabet").style.display = 'none';document.getElementById('previous2').innerHTML = document.getElementById('content2').innerHTML;query(2,new Array('f_id','f_ori_name','f_eng_name','sci_name','langual','foodexcode','mainlevelcode','codlevel1','namelevel1','codsublevel','codlevel2','namelevel2','f_des_esp','f_des_ing','photo','edible_portion','f_origen','c_id','c_ori_name','c_eng_name','eur_name','componentgroup_id','glos_esp','glos_ing','cg_descripcion','cg_description','best_location','v_unit','moex','stdv','min','max','v_n','u_id','u_descripcion','u_description','value_type','vt_descripcion','vt_description','mu_id','mu_descripcion','mu_description','ref_id','citation','at_descripcion','at_description','pt_descripcion','pt_description','method_id','mt_descripcion','mt_description','m_descripcion','m_description','m_nom_esp','m_nom_ing','mhd_descripcion','mhd_description'),new Array('f_id','publico'),new Array('EQUAL','EQUAL'),new Array(),new Array('<xsl:value-of select="f_id"/>',1),'componentgroup_id','ASC')</xsl:attribute><xsl:value-of select="f_eng_name" /></a>
				</TD>

            </TR>

          </xsl:for-each>
</TABLE>
<br />

<br />

</xsl:template>

</xsl:stylesheet>
