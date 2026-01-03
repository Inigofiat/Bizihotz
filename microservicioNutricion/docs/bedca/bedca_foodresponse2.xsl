<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:param name="factorc" />

<xsl:template match="/">

<p align="center"><a href="javascript:void(0)" class="button" id="Todos" onclick="scroll(0,0);if (enalpha == 1) document.getElementById('alphabet').style.display = 'block';document.getElementById('content2').innerHTML = document.getElementById('previous2').innerHTML;"><span>Listado anterior</span></a>
</p>
<br />

<h2 align="center">Información detallada del Alimento </h2>
<br />
<xsl:call-template name="foodinfo" />

<xsl:call-template name="foodgraphic"/>

<h4 align="center" style="background:#9EC9F8">Información de composición (por <xsl:value-of select='format-number($factorc,"#")' /> g de porción comestible)</h4>
<br />
<br />
<TABLE align="center">
<TR>
        <TH>Componente</TH>
				<TH>Valor</TH>
				<TH>Unidad</TH>
				<TH>Fuente</TH>
</TR>

<xsl:variable name="energ">
<xsl:for-each select="foodresponse/food/foodvalue">
<xsl:if test="eur_name = 'ENERC'">
<xsl:value-of select="1" />
</xsl:if>
</xsl:for-each>
</xsl:variable>

<xsl:variable name="prote">
<xsl:for-each select="foodresponse/food/foodvalue">
<xsl:if test="eur_name = 'PROT'">
<xsl:if test="string(best_location) != 'NaN' and string(best_location) != ''">
<xsl:value-of select='format-number(17 * best_location,"#0.##")' />
</xsl:if>
<xsl:if test="string(best_location) = 'NaN' or string(best_location) = ''">
<xsl:value-of select='0' />
</xsl:if>
</xsl:if>
</xsl:for-each>
</xsl:variable>

<xsl:variable name="fate">
<xsl:for-each select="foodresponse/food/foodvalue">
<xsl:if test="eur_name = 'FAT'">
<xsl:if test="string(best_location) != 'NaN' and string(best_location) != ''">
<xsl:value-of select='format-number(37 * best_location,"#0.##")' />
</xsl:if>
<xsl:if test="string(best_location) = 'NaN' or string(best_location) = ''">
<xsl:value-of select='0' />
</xsl:if>
</xsl:if>
</xsl:for-each>
</xsl:variable>

<xsl:variable name="choe">
<xsl:for-each select="foodresponse/food/foodvalue">
<xsl:if test="eur_name = 'CHO'">
<xsl:if test="string(best_location) != 'NaN' and string(best_location) != ''">
<xsl:value-of select='format-number(17 * best_location,"#0.##")' />
</xsl:if>
<xsl:if test="string(best_location) = 'NaN' or string(best_location) = ''">
<xsl:value-of select='0' />
</xsl:if>
</xsl:if>
</xsl:for-each>
</xsl:variable>

<xsl:variable name="alce">
<xsl:for-each select="foodresponse/food/foodvalue">
<xsl:if test="eur_name = 'ALC'">
<xsl:if test="string(best_location) != 'NaN' and string(best_location) != ''">
<xsl:value-of select='format-number(29 * best_location,"#0.##")' />
</xsl:if>
<xsl:if test="string(best_location) = 'NaN' or string(best_location) = ''">
<xsl:value-of select='0' />
</xsl:if>
</xsl:if>
</xsl:for-each>
</xsl:variable>

<xsl:variable name="prote2">
<xsl:if test="$prote = ''">
<xsl:value-of select='0' />
</xsl:if>
<xsl:if test="$prote != ''">
<xsl:value-of select='$prote' />
</xsl:if>
</xsl:variable>

<xsl:variable name="fate2">
<xsl:if test="$fate = ''">
<xsl:value-of select='0' />
</xsl:if>
<xsl:if test="$fate != ''">
<xsl:value-of select='$fate' />
</xsl:if>
</xsl:variable>

<xsl:variable name="choe2">
<xsl:if test="$choe = ''">
<xsl:value-of select='0' />
</xsl:if>
<xsl:if test="$choe != ''">
<xsl:value-of select='$choe' />
</xsl:if>
</xsl:variable>

<xsl:variable name="alce2">
<xsl:if test="$alce = ''">
<xsl:value-of select='0' />
</xsl:if>
<xsl:if test="$alce != ''">
<xsl:value-of select='$alce' />
</xsl:if>
</xsl:variable>

<xsl:for-each select="foodresponse/componentList/component">
	<xsl:variable name="componentId">
	<xsl:value-of select='id' />
	</xsl:variable>
	<xsl:variable name="rowType">
		<xsl:if test="position() mod 2 = 1"><xsl:value-of select="'row-a'" /></xsl:if>
	    <xsl:if test="position() mod 2 = 0"><xsl:value-of select="'row-b'" /></xsl:if>
	</xsl:variable>
	<xsl:choose>
    <xsl:when test="not(../../food/foodvalue[c_id=$componentId])">
    	<xsl:if test="id = 404 or id = 307 or id = 260 or id = 100 or id = 317">
    	<TR>
<TD style="color:#FFFFFF; background-color:#666600"><a style="color:#FFFFFF" href="javascript:void(0)"><xsl:value-of select="group" /></a></TD>
<TD style="color:#FFFFFF; background-color:#666600"  /><TD style="color:#FFFFFF; background-color:#666600"  /><TD style="color:#FFFFFF; background-color:#666600"  />
</TR>
		</xsl:if>
		<tr>
			<xsl:attribute name="class">
		    	<xsl:value-of select="$rowType" />
			</xsl:attribute>
			<td><b><xsl:value-of select='name_esp' /></b></td><td align="center">-</td><td align="center">-</td><td align="center">-</td>
		</tr>
	</xsl:when>
	<xsl:otherwise>
	<xsl:for-each select="../../food/foodvalue[c_id=$componentId]">
	    <xsl:call-template name="foodcomposition">
	    	<xsl:with-param name="rowType" select="$rowType" />
	    	<xsl:with-param name="compid" select="$componentId" />
			<xsl:with-param name="comptype" select="componentgroup_id" />
			<xsl:with-param name="title" select="cg_descripcion" />
	        <xsl:with-param name="conversion" select="$factorc" />
	        <xsl:with-param name="cgide" select="componentgroup_id" />
	        <xsl:with-param name="prote3" select="$prote2" />
	        <xsl:with-param name="fate3" select="$fate2" />
	        <xsl:with-param name="choe3" select="$choe2" />
	        <xsl:with-param name="alce3" select="$alce2" />
		</xsl:call-template>
	</xsl:for-each>
	</xsl:otherwise>
	</xsl:choose>
</xsl:for-each>

</TABLE>
<br />
<br />

</xsl:template>

<xsl:template name="foodinfo">

<h4 id="foodname" style="background:#9EC9F8" align="center"><xsl:value-of select="foodresponse/food/f_ori_name[1]" /></h4>
<br />
<TABLE>
	<TR>
		<TD>
			<TD>
            <p style="display:none" id="origen"><xsl:value-of select="foodresponse/food/f_origen[1]" /></p>
			<p><b style="color:#597ca6">English name: </b><xsl:value-of select="foodresponse/food/f_eng_name[1]" /></p>
			<p><b style="color:#597ca6">Nombre científico: </b><xsl:value-of select="foodresponse/food/sci_name[1]" /></p>
			<p><b style="color:#597ca6">Código foodex: </b><xsl:value-of select="foodresponse/food/foodexcode[1]" /> - <span><xsl:attribute name="title"><xsl:value-of select="foodresponse/food/namelevel1[1]" /></xsl:attribute><xsl:value-of select="foodresponse/food/codlevel1[1]" /></span> (<xsl:value-of select="foodresponse/food/namelevel1[1]" />) - <span><xsl:attribute name="title"><xsl:value-of select="foodresponse/food/namelevel2[1]" /></xsl:attribute><xsl:value-of select="foodresponse/food/codlevel2[1]" /> (<xsl:value-of select="foodresponse/food/namelevel2[1]" />)</span></p>
			<p><b style="color:#597ca6">Parte comestible (%): </b><xsl:value-of select='format-number(100*(foodresponse/food/edible_portion[1]),"#")' /></p>
			<p><b style="color:#597ca6">Descripción: </b></p>
    	<xsl:if test="system-property('xsl:vendor')='Transformiix'">
        	<pre id="descripcion" width="75"><xsl:value-of select="foodresponse/food/f_des_esp[1]"/></pre>
		</xsl:if>
		<xsl:if test="system-property('xsl:vendor')!='Transformiix'">
        	<p id="descripcion"><xsl:value-of select="foodresponse/food/f_des_esp[1]" disable-output-escaping="yes"/></p>
		</xsl:if>
		</TD>
		</TD>		</TR> 	   </TABLE>
</xsl:template>

<xsl:template name="foodgraphic">

<h4 align="center" style="background:#9EC9F8">Distribución de la Energía total</h4>
<br />
<TABLE align="center">
	<TR>
		<TD>
			<div id="ffgraphic"><object type="image/svg+xml" width="575" height="135"><xsl:attribute name="data">http://www.bedca.net/cocoon/svg/response<xsl:value-of select="foodresponse/food/f_id[1]" />langes.svg</xsl:attribute>
			</object></div>
		</TD>
	</TR>
</TABLE>

</xsl:template>

<xsl:template name="foodcomposition">
<xsl:param name="rowType" />
<xsl:param name="compid" />
<xsl:param name="comptype" />
<xsl:param name="title" />
<xsl:param name="conversion" />
<xsl:param name="cgide" />
<xsl:param name="prote3" />
<xsl:param name="fate3" />
<xsl:param name="choe3" />
<xsl:param name="alce3" />
			<xsl:if test="$compid = 404 or $compid = 307 or $compid = 260 or $compid = 100 or $compid = 317">
			<TR>
<TD style="color:#FFFFFF; background-color:#666600"><a style="color:#FFFFFF" href="javascript:void(0)"><xsl:value-of select="$title" /></a></TD>
<TD style="color:#FFFFFF; background-color:#666600"  /><TD style="color:#FFFFFF; background-color:#666600"  /><TD style="color:#FFFFFF; background-color:#666600"  />
</TR>
			</xsl:if>

			<tbody style="display:table-row-group">

				<TR>

				<xsl:attribute name="class"><xsl:value-of select="$rowType"></xsl:value-of></xsl:attribute>


			  	<TD style="cursor:pointer"><xsl:attribute name="onclick">slc(document.getElementById('glos<xsl:value-of select="c_ori_name" />').innerHTML,'información del componente')</xsl:attribute>
					<b><xsl:value-of select="c_ori_name" /></b>
				</TD>

				<xsl:choose>

					<xsl:when test="eur_name = 'ENERC'">
			  		<xsl:choose>
			  			<xsl:when test="string(best_location) != ''">
                        	<xsl:if test="v_unit = 'kJ'">
                            <xsl:choose>
                            <xsl:when test="moex = 'W'">
              				<TD align="center">
								<xsl:value-of select='format-number(0.01 * $conversion * best_location,"#")' /> (<xsl:value-of select='format-number(0.01 * $conversion * 0.24 * best_location,"#")' />)
							</TD>
                            </xsl:when>
                            <xsl:otherwise>
              				<TD align="center">
								<xsl:value-of select='format-number(best_location,"#")' /> (<xsl:value-of select='format-number(0.24 * best_location,"#")' />)
							</TD>
                            </xsl:otherwise>
                            </xsl:choose>
                            </xsl:if>
                            <xsl:if test="v_unit = 'kcal'">
                            <xsl:choose>
              				<xsl:when test="moex = 'W'">
              				<TD align="center">
								<xsl:value-of select='format-number(0.01 * $conversion * 4.18 * best_location,"#")' /> (<xsl:value-of select='format-number(0.01 * $conversion * best_location,"#")' />)
							</TD>
                            </xsl:when>
                            <xsl:otherwise>
              				<TD align="center">
								 <xsl:value-of select='format-number(4.18 * best_location,"#")' />(<xsl:value-of select='format-number(best_location,"#")' />)
							</TD>
                            </xsl:otherwise>
                            </xsl:choose>
                            </xsl:if>
			  			</xsl:when>

			  			<xsl:otherwise>
			  				<TD align="center">
							</TD>
			  			</xsl:otherwise>

			  		</xsl:choose>
                    		<TD align="center">kJ (kcal)</TD>
                            <xsl:choose>
                            <xsl:when test="moex = 'W'">
                            </xsl:when>
                            <xsl:otherwise>

                            </xsl:otherwise>
                            </xsl:choose>
			  		</xsl:when>

			  		<xsl:otherwise>
						<xsl:choose>
			  			<xsl:when test="string(best_location) != ''">
                    	<xsl:choose>
                    	<xsl:when test="moex = 'W'">
			  			<TD align="center">
						<xsl:value-of select='format-number(0.01 * $conversion * best_location,"#0.####")' /></TD>
			  			<TD align="center" style="cursor:help"><xsl:attribute name="title"><xsl:value-of select="u_descripcion" /></xsl:attribute>
						<xsl:value-of select="v_unit" />
					</TD>
                        </xsl:when>
                        <xsl:otherwise>
              <xsl:choose>
              <xsl:when test="moex = 'WKG'">
			  			<TD align="center">
						<xsl:value-of select='format-number(best_location div 10,"#0.##")' /></TD>
			  			<TD align="center" style="cursor:help"><xsl:attribute name="title"><xsl:value-of select="u_descripcion" /></xsl:attribute>
						<xsl:value-of select="v_unit" />
					</TD>
					</xsl:when>
					<xsl:otherwise>
						<TD align="center">
						<xsl:value-of select='format-number(best_location,"#0.##")' /></TD>
			  			<TD align="center" style="cursor:help"><xsl:attribute name="title"><xsl:value-of select="u_descripcion" /></xsl:attribute>
						<xsl:value-of select="v_unit" />
					</TD>
					</xsl:otherwise>
					</xsl:choose>

                        </xsl:otherwise>
                        </xsl:choose>
                        </xsl:when>
                        <xsl:otherwise>
                        <xsl:choose>
                    	<xsl:when test="moex = 'W'">
			  			<xsl:choose>
                    	<xsl:when test="value_type = 'TR'">
			  							<TD align="center">traza</TD>
			  							</xsl:when>
			  							<xsl:otherwise><TD align="center"></TD></xsl:otherwise>
			  							</xsl:choose>
			  			<TD align="center" style="cursor:help"><xsl:attribute name="title"><xsl:value-of select="u_descripcion" /></xsl:attribute>
						<xsl:value-of select="v_unit" />
					</TD>
                        </xsl:when>
                        <xsl:otherwise>
              				<xsl:choose>
                    	<xsl:when test="value_type = 'TR'">
			  							<TD align="center">traza</TD>
			  							</xsl:when>
			  							<xsl:otherwise><TD align="center"></TD></xsl:otherwise>
			  							</xsl:choose>
			  			<TD align="center" style="cursor:help"><xsl:attribute name="title"><xsl:value-of select="u_descripcion" /></xsl:attribute>
						<xsl:value-of select="v_unit" />
					</TD>

                        </xsl:otherwise>
                        </xsl:choose>
                        </xsl:otherwise>
                        </xsl:choose>
			  		</xsl:otherwise>

			  	</xsl:choose>

			  	<TD align="center">
					<a href="javascript:void(0)">
						<xsl:attribute name="onclick">slc(document.getElementById('refdet<xsl:value-of select="ref_id" />').innerHTML,'información de la referencia BEDCA'); return true;</xsl:attribute>
						<xsl:value-of select="ref_id" /></a>
				</TD>
<div style="display:none"><xsl:attribute name="id">glos<xsl:value-of select="c_ori_name"/></xsl:attribute>
<xsl:value-of select='glos_esp' />
</div>
<div style="display:none"><xsl:attribute name="id">refdet<xsl:value-of select="ref_id"/></xsl:attribute>
<B>Referencia: </B> <xsl:value-of select="citation"/><br />
<B>Tipo de adquisición: </B> <xsl:value-of select="at_descripcion"/><br />
<B>Tipo de publicación: </B> <xsl:value-of select="pt_descripcion"/><br />
</div>

			</TR>

</tbody>
</xsl:template>

</xsl:stylesheet>