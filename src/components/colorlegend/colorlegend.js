import * as utils from "../../legacy/base/utils";
import { BaseComponent } from "../base-component";
import { ICON_CLOSE as iconClose } from "../../icons/iconset"
import ColorPicker from "../../legacy/helpers/d3.colorPicker";
import axisSmart from "../../legacy/helpers/d3.axisWithLabelPicker";
import { STATUS, isEntityConcept } from "../../utils.js";
import "./colorlegend.scss";
import { runInAction } from "mobx";

/*!
 * VIZABI BUBBLE COLOR LEGEND COMPONENT
 */

export class ColorLegend extends BaseComponent {
  constructor(config) {
    config.template = `
      <div class="vzb-cl-outer">
        <div class="vzb-cl-holder">
          <div class="vzb-cl-minimap">
            <svg>
              <g></g>
            </svg>
          </div>

          <div class="vzb-cl-colorlist vzb-hidden"></div>

          <div class="vzb-cl-rainbow-holder vzb-hidden">
            <div class="vzb-cl-rainbow">
              <canvas></canvas>
            </div>

            <div class="vzb-cl-rainbow-legend">
              <svg>
                <g>
                  <rect></rect>
                </g>
              </svg>
            </div>

            <div class="vzb-cl-labelscale">
              <svg>
                <g></g>
              </svg>
            </div>

            <div class="vzb-cl-subtitle">
              <span class="vzb-cl-subtitle-text"></span>
            </div>
          </div>
          
          <span class="vzb-cl-more-hint vzb-hidden">click for more options</span>

          <div class="vzb-cl-select-dialog">
            <div class="vzb-cl-select-dialog-title"></div>
            <div class="vzb-cl-select-dialog-close"></div>
          </div>
      </div>
    `;

    super(config);
  }

  setup(options) {
    this.DOM = {
      wrapper: this.element.select(".vzb-cl-holder"),
    };

    this.DOM.minimap = this.DOM.wrapper.select(".vzb-cl-minimap");
    this.DOM.minimapSVG = this.DOM.minimap.select("svg");
    this.DOM.minimapG = this.DOM.minimapSVG.select("g");

    this.DOM.listColors = this.DOM.wrapper.select(".vzb-cl-colorlist");

    this.DOM.rainbowHolder = this.DOM.wrapper.select(".vzb-cl-rainbow-holder");
    this.DOM.rainbow = this.DOM.rainbowHolder.select(".vzb-cl-rainbow");
    this.DOM.rainbowCanvas = this.DOM.rainbow.select("canvas");
    this.DOM.rainbowLegend = this.DOM.rainbowHolder.select(".vzb-cl-rainbow-legend");
    this.DOM.rainbowLegendSVG = this.DOM.rainbowLegend.select("svg");
    this.DOM.rainbowLegendG = this.DOM.rainbowLegendSVG.select("g");
    //this.DOM.rainbowLegendG.append("rect");
    this.rainbowLegend = null;

    this.DOM.labelScale = this.DOM.rainbowHolder.select(".vzb-cl-labelscale");
    this.DOM.labelScaleSVG = this.DOM.labelScale.select("svg");
    this.DOM.labelScaleG = this.DOM.labelScaleSVG.select("g");
    this.DOM.subtitleDiv = this.DOM.rainbowHolder.select(".vzb-cl-subtitle");
    this.DOM.subtitleText = this.DOM.subtitleDiv.select(".vzb-cl-subtitle-text");

    this.legendModelName = options.legendModelName
    this.colorModelName = options.colorModelName;
  
    this.colorPicker = new ColorPicker(this.root.element);
    this._initSelectDialog();
  }

  draw() {
    this.MDL = {
      color: this.model.encoding.get(this.colorModelName),
      selected: this.model.encoding.get("selected"),
      highlighted: this.model.encoding.get("highlighted"),
      superHighlighted: this.model.encoding.get("superhighlighted"),
    }
    this.MDL.legend = this.root.model.stores ? this.root.model.stores.markers.get(this.legendModelName) : null;
    this.localise = this.services.locale.auto();
    this.colorPicker.translate(this.localise);

    this.legendHasOwnModel = !this.MDL.color.data.isConstant() && ["entity_set", "entity_domain"]
      .includes(this.MDL.color.data.conceptProps.concept_type);
    
    if (this.MDL.legend && this.legendHasOwnModel && !this._isLegendModelReady()) return;

    this.KEY = Symbol.for("key");
    this.canShowMap = this.MDL.legend && this._canShowMap();
    this.which = this.MDL.color.data.constant || this.MDL.color.data.concept;

    this.addReaction(this._updateView);
    this.addReaction(this._translateSelectDialog);
    this.addReaction(this._updateSelectDialog);

  }

  _isLegendModelReady() {
    return this.MDL.legend.state == STATUS.READY;
  }

  _canShowMap() {
    if(!this.legendHasOwnModel) return false;
    const dataArray = this.MDL.legend.dataArray;
    return dataArray.length > 0 && dataArray.every(d => d.map);
  }

  _updateView() {
    if (this.MDL.legend && this.legendHasOwnModel && !this._isLegendModelReady()) return;

    const individualColors = false;
    this._updateListLegend(this.MDL.color.scale.isDiscrete() && !this.canShowMap && !individualColors);
    this._updateMinimapLegend(this.MDL.color.scale.isDiscrete() && this.canShowMap);
    this._updateRainbowLegend(!this.MDL.color.scale.isDiscrete());
  }

  _updateListLegend(isVisible) {
    this.DOM.listColors.classed("vzb-hidden", !isVisible);
    if (!isVisible) return;

    const KEY = this.KEY;
    const _this = this;
    const cScale = this.MDL.legend ? this.MDL.legend.encoding.get("color").scale.d3Scale : this.MDL.color.scale.d3Scale;

    let colorOptionsArray = [];

    if (this.MDL.legend && !this.MDL.color.data.isConstant()) {
      colorOptionsArray = this.MDL.legend.dataArray;
      //this.which == KEY ? this.markerArray : this.colorlegendMarkerArray;
    } else {
      colorOptionsArray = cScale.domain().map(value => {
        const result = {};
        result[this.which] = value;
        return result;
      });
    }

    let colorOptions = this.DOM.listColors.selectAll(".vzb-cl-option")
      .data(utils.unique(colorOptionsArray, d => d[this.which]), d => d[this.which]);

    colorOptions.exit().remove();

    colorOptions = colorOptions.enter().append("div").attr("class", "vzb-cl-option")
      .each(function() {
        d3.select(this).append("div").attr("class", "vzb-cl-color-sample");
        d3.select(this).append("div").attr("class", "vzb-cl-color-legend");
      })
      .on("mouseover", _this._interact().mouseover)
      .on("mouseout", _this._interact().mouseout)
      .on("click", (...args) => {
        if (_this.legendHasOwnModel) {
          this._bindSelectDialogItems(...args);
          this.DOM.selectDialog.classed("vzb-hidden", false);
        } else {
          this._interact().clickToChangeColor(...args);
        }
      })
      .merge(colorOptions);

    colorOptions.each(function(d, index) {
      d3.select(this).select(".vzb-cl-color-sample")
        .style("background-color", cScale(d[_this.which]))
        .style("border", "1px solid " + cScale(d[_this.which]));
      //Apply names to color legend entries if color is a property
      let label = d["name"];
      if (!label && label !== 0) label = d[_this.which];
      if (_this.MDL.color.data.isConstant()) label = _this.localise("indicator/_default/color");
      d3.select(this).select(".vzb-cl-color-legend").text(label);
    });
  }

  _updateMinimapLegend(isVisible) {
    this.DOM.minimap.classed("vzb-hidden", !isVisible);
    if (!isVisible) return;

    if (!this._isLegendModelReady()) return;

    const _this = this;
    const cScale = this.MDL.legend.encoding.get("color").scale.d3Scale;

    const tempdivEl = this.DOM.minimap.append("div").attr("class", "vzb-temp");

    this.DOM.minimapSVG.attr("viewBox", null);
    this.DOM.minimapSVG.selectAll("g").remove();
    this.DOM.minimapG = this.DOM.minimapSVG.append("g");
    this.DOM.minimapG.selectAll("path")
      .data(this.MDL.legend.dataArray, d => d[this.KEY])
      .enter().append("path")
      .on("mouseover", this._interact().mouseover)
      .on("mouseout", this._interact().mouseout)
      .on("click", (...args) => {
        this._bindSelectDialogItems(...args);
        this.DOM.selectDialog.classed("vzb-hidden", false);
      })
      .each(function(d) {
        let shapeString = d["map"].trim();

        //check if shape string starts with svg tag -- then it's a complete svg
        if (shapeString.slice(0, 4) == "<svg") {
          //append svg element from string to the temporary div
          tempdivEl.html(shapeString);
          //replace the shape string with just the path data from svg
          //TODO: this is not very resilient. potentially only the first path will be taken!
          shapeString = tempdivEl.select("svg").select("path").attr("d");
        }

        d3.select(this)
          .attr("d", shapeString)
          .style("fill", cScale(d["color"]))
          .append("title").text(d["name"]);

        tempdivEl.html("");
      });

    const gbbox = this.DOM.minimapG.node().getBBox();
    this.DOM.minimapSVG.attr("viewBox", "0 0 " + gbbox.width * 1.05 + " " + gbbox.height * 1.05);
    tempdivEl.remove();

  }

  _interact() {
    const _this = this;
    const KEYS = this.KEYS;
    const KEY = this.KEY;
    const which = this.which;

    return {
      mouseover(d, i) {
        _this.DOM.moreOptionsHint.classed("vzb-hidden", false);
        //disable interaction if so stated in concept properties
        if (!_this.MDL.color.scale.isDiscrete()) return;

        const view = d3.select(this);
        const target = d[which];
        const _isEntityConcept = isEntityConcept(_this.MDL.color.data.conceptProps || {});

        if (_isEntityConcept) {
          const key = _this.MDL.color.name;
          const trailKey = Symbol.for("trailHeadKey");
          _this._highlight(_this.model.dataArray.filter(data => !data[trailKey] && data[key] == target));
        } else {

        }

        // if (_this.colorModel.use == "indicator") {
        //   _this.model.marker.getFrame(_this.model.time.value, frame => {
        //     if (!frame) return;

        //     const filterHash = Object.keys(frame[_this.colorModel._name]).filter(key => frame[_this.colorModel._name][key] == target)
        //       .reduce((result, key) => {
        //         result[key] = true;
        //         return result;
        //       }, {});

        //     _this._highlight(_this.markerArray.filter(d => filterHash[utils.getKey(d, _this.colorModel.getDataKeys())]));
        //   });
        // } else if (_this.colorModel.use == "property") {
        //   const filterHash = _this.colorModel.getValidItems()
        //     //filter so that only countries of the correct target remain
        //     .filter(f => f[_this.colorModel.which] == target)
        //     .reduce((result, d) => {
        //       result[d[KEY]] = true;
        //       return result;
        //     }, {});

        //   _this._highlight(_this.markerArray.filter(key => filterHash[key[KEY]]));
        // } else {
        //   // in case of constant do nothing
        // }
      },

      mouseout(d, i) {
        _this.DOM.moreOptionsHint.classed("vzb-hidden", true);
        //disable interaction if so stated in concept properties
        if (!_this.MDL.color.scale.isDiscrete()) return;
        _this._unhighlight();
      },
      clickToChangeColor(d, i, group, d3event = d3.event) {
        //disable interaction if so stated in concept properties
        //if (!_this.MDL.color.scale.palette.isUserSelectable) return;
        const colorScaleModel = _this.MDL.color.scale;
        const palette = colorScaleModel.palette.palette;
        const defaultPalette = colorScaleModel.palette.defaultPalette;
        const view = d3.select(this);
        const target = !colorScaleModel.isDiscrete() ? d.paletteKey : d[which];
        _this.colorPicker
          .colorOld(colorScaleModel.palette.getColor(target))
          .colorDef(colorScaleModel.palette.getColor(target, defaultPalette))
          .callback((value, isClick) => colorScaleModel.palette.setColor(value, "" + target, null, isClick, isClick))
          .fitToScreen([d3event.pageX, d3event.pageY])
          .show(true);
      },
      clickToShow(d, i) {
        //disable interaction if so stated in concept properties
        if (!_this.MDL.color.scale.isDiscrete()) return;

        const view = d3.select(this);
        const target = d[which];

        const oldShow = _this.model.entities.show[which] && _this.model.entities.show[which]["$in"] ?
          utils.clone(_this.model.entities.show[which]["$in"]) :
          [];

        const entityIndex = oldShow.indexOf(d[which]);
        if (entityIndex !== -1) {
          oldShow.splice(entityIndex, 1);
        } else {
          oldShow.push(d[which]);
        }

        const show = {};
        if (oldShow.length > 0)
          show[which] = { "$in": oldShow };

        _this.model.entities.set({ show });

      },
      clickToSelect(d, i) {
        //disable interaction if so stated in concept properties
        if (!_this.MDL.color.scale.isDiscrete()) return;

        const view = d3.select(this);
        const target = d[which];
        const key = _this.MDL.color.name;
        const selectedFilter = _this.MDL.selected.data.filter;
        const trailKey = Symbol.for("trailHeadKey");

        const selectArray = _this.model.dataArray.filter(data => !data[trailKey] && data[key] == target);
        
        if (selectArray.every(d => selectedFilter.has(d))) {
          runInAction(() => selectedFilter.delete(selectArray));
        } else {
          runInAction(() => selectedFilter.set(selectArray));
        }


        return 

        // const filterHash = _this.colorModel.getValidItems()
        //   //filter so that only countries of the correct target remain
        //   .filter(f => f[_this.colorModel.which] == target)
        //   //fish out the "key" field, leave the rest behind
        //   .reduce((result, d) => {
        //     result[d[KEY]] = true;
        //     return result;
        //   }, {});

        // const select = _this.markerArray.filter(f => filterHash[f[KEY]])
        //   .map(d => utils.clone(d, KEYS));

        // if (select.filter(d => _this.model.marker.isSelected(d)).length == select.length) {
        //   _this.model.marker.clearSelected();
        // } else {
        //   _this.model.marker.setSelect(select);
        // }
      }
    };
  }

  _initSelectDialog() {
    this.DOM.moreOptionsHint = this.DOM.wrapper.select(".vzb-cl-more-hint");

    this.DOM.selectDialog = this.DOM.wrapper.select(".vzb-cl-select-dialog");
    this._initSelectDialogItems();
  }

  _initSelectDialogItems() {
    this.DOM.selectDialogTitle = this.DOM.selectDialog.select(".vzb-cl-select-dialog-title");

    this.DOM.selectDialogClose = this.DOM.selectDialog.select(".vzb-cl-select-dialog-close");
    this.DOM.selectDialogClose
      .html(iconClose)
      .on("click", () => this._closeSelectDialog());

    this.DOM.selectAllButton = this.DOM.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-item", true);

    this.DOM.removeElseButton = this.DOM.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-item", true);

    this.DOM.editColorButton = this.DOM.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-item vzb-cl-select-dialog-item-moreoptions", true);

    this.DOM.editColorButtonTooltip = this.DOM.editColorButton.append("div")
      .classed("vzb-cl-select-dialog-item-tooltip", true);
  }

  _translateSelectDialog() {
    const t = this.localise;
    this.DOM.moreOptionsHint.text(t("hints/color/more"));
    this.DOM.selectAllButton.text("✅ " + t("dialogs/color/select-all"));
    this.DOM.removeElseButton.text("🗑️ " + t("dialogs/color/remove-else"));
    this.DOM.editColorButton.text("🎨 " + t("dialogs/color/edit-color"));
    this.DOM.editColorButtonTooltip.text(t("dialogs/color/edit-color-blocked-hint"));
  }

  _updateSelectDialog() {
    const isColorSelectable = this.MDL.color.scale.palette.isUserSelectable;
    this.DOM.editColorButtonTooltip.classed("vzb-hidden", isColorSelectable);
    this.DOM.editColorButton.classed("vzb-cl-select-dialog-item-disabled", !isColorSelectable);

    this.DOM.selectDialog.classed("vzb-hidden", true);
  }

  _closeSelectDialog() {
    this.DOM.selectDialog.classed("vzb-hidden", true);
  }

  _bindSelectDialogItems(...args) {
    const [, index, indicators] = args;
    this.DOM.selectDialogTitle.text(indicators[index].textContent);

    this.DOM.selectAllButton.on("click", () => {
      this._interact().clickToSelect(...args);
      this._closeSelectDialog();
    });

    this.DOM.removeElseButton.on("click", () => {
      this._interact().clickToShow(...args);
      this._closeSelectDialog();
    });

    this.DOM.editColorButton.on("click", () => {
      this._interact().clickToChangeColor(...args);
      this._closeSelectDialog();
    });
  }

  _highlight(values) {
    if (!values.length) return;
    utils.getProp(this, ["root", "ui", "chart", "superhighlightOnMinimapHover"]) ?
      this.MDL.superHighlighted.data.filter.set(values) :
      this.MDL.highlighted.data.filter.set(values);
  }

  _unhighlight() {
    utils.getProp(this, ["root", "ui", "chart", "superhighlightOnMinimapHover"]) ?
      this.MDL.superHighlighted.data.filter.clear() :
      this.MDL.highlighted.data.filter.clear();
  }

  _updateRainbowLegend(isVisible) {
    const _this = this;
    const colorModel = this.MDL.color.scale;

    //Hide rainbow element if showing minimap or if color is discrete
    this.DOM.rainbowHolder.classed("vzb-hidden", !isVisible);
    //this.DOM.labelScale.classed("vzb-hidden", !isVisible);
    //this.DOM.rainbowLegend.classed("vzb-hidden", !isVisible);
    if (!isVisible) return;

    const gradientWidth = this.DOM.rainbow.node().getBoundingClientRect().width;
    const paletteKeys = colorModel.palette.paletteDomain.map(parseFloat);
    const cScale = colorModel.d3Scale.copy();
    const circleRadius = 6;

    let domain;
    let range;
    //const formatter = colorModel.getTickFormatter();
    let fitIntoScale = null;

    const paletteLabels = colorModel.palette.paletteLabels;

    if (paletteLabels) {

      fitIntoScale = "optimistic";

      domain = paletteLabels.map(val => parseFloat(val));
      const paletteMax = d3.max(domain);
      range = domain.map(val => val / paletteMax * gradientWidth);

    } else {

      domain = cScale.domain();
      const paletteMax = d3.max(paletteKeys);
      range = paletteKeys.map(val => val / paletteMax * gradientWidth);

    }

    //const labelScaleType = (d3.min(domain) <= 0 && d3.max(domain) >= 0 && colorModel.scaleType === "log") ? "genericLog" : colorModel.scaleType;

    this.labelScale = cScale.copy()
      .interpolate(d3.interpolate)
      .range(range);

    const marginLeft = parseInt(this.DOM.rainbow.style("left"), 10) || 0;
    const marginRight = parseInt(this.DOM.rainbow.style("right"), 10) || marginLeft;

    this.DOM.labelScaleSVG.style("width", marginLeft + gradientWidth + marginRight + "px");
    this.DOM.labelScaleG.attr("transform", "translate(" + marginLeft + ",2)");
    this.labelsAxis = axisSmart("bottom");
    this.labelsAxis.scale(this.labelScale)
      //.tickFormat(formatter)
      .tickSizeOuter(5)
      .tickPadding(8)
      .tickSizeMinor(3, -3)
      .labelerOptions({
        scaleType: colorModel.type,
        toolMargin: {
          right: marginRight,
          left: marginLeft
        },
        showOuter: false,
        formatter: this.localise,
        bump: marginLeft,
        cssFontSize: "8px",
        fitIntoScale
      });

    this.DOM.labelScaleG.call(this.labelsAxis);

    this.DOM.rainbowCanvas
      .attr("width", gradientWidth)
      .attr("height", 1)
      .style("width", gradientWidth + "px")
      .style("height", "100%");

    const context = this.DOM.rainbowCanvas.node().getContext("2d");
    const image = context.createImageData(gradientWidth, 1);
    for (let i = 0, j = -1, c; i < gradientWidth; ++i) {
      c = d3.rgb(cScale(this.labelScale.invert(i)));
      image.data[++j] = c.r;
      image.data[++j] = c.g;
      image.data[++j] = c.b;
      image.data[++j] = 255;
    }
    context.putImageData(image, 0, 0);

    const conceptProps = this.MDL.color.data.conceptProps;
    const subtitle = utils.getSubtitle(conceptProps.name, conceptProps.name_short);

    this.DOM.subtitleDiv.classed("vzb-hidden", subtitle == "");
    this.DOM.subtitleText.text(subtitle);

    //rainbow legend setup
    if (this.DOM.rainbowLegend.style("display") !== "none") {
      const edgeDomain = d3.extent(domain);

      this.domainScale = this.labelScale.copy()
        .domain(edgeDomain)
        .range(edgeDomain);

      this.paletteScaleLinear = d3.scaleLinear().domain(edgeDomain).range([0, 100]);

      this.DOM.rainbowLegendSVG.style("width", marginLeft + gradientWidth + marginRight + "px");
      this.DOM.rainbowLegendG.attr("transform", "translate(" + marginLeft + ", " + 7 + ")");

      this.DOM.labelScale.selectAll(".vzb-axis-value text").attr("dy", "1.5em");

      if (!edgeDomain.includes(0)) {
        //find tick with zero
        const zeroTickEl = this.DOM.labelScaleG.selectAll(".tick text").filter(function() { return d3.select(this).text() === "0"; })
          .style("cursor", "pointer")
          .on("dblclick", () => {
            const color = cScale(0);
            const paletteKey = +_this.paletteScaleLinear(_this.domainScale(0));
            colorModel.palette.setColor(color, "" + paletteKey, null, true, true);
          });
      }

      this.DOM.rainbowLegendG.select("rect")
        .attr("width", gradientWidth)
        .attr("height", 20)
        .on("mousemove", function() {
          _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue(_this.labelScale.invert(d3.mouse(this)[0])));
        })
        .on("mouseleave", () => _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue("none")))
        .on("dblclick", function() {
          let x = d3.mouse(this)[0];
          x = x <= (circleRadius * 2) ? circleRadius * 2 : x >= (gradientWidth - circleRadius * 2) ? gradientWidth - circleRadius * 2 : x;
          const newValue = _this.labelScale.invert(x);
          const color = cScale(newValue);
          const paletteKey = _this.paletteScaleLinear(_this.domainScale(newValue));
          colorModel.palette.setColor(color, "" + paletteKey, null, true, true);
        });

      const colorRange = cScale.range();

      const value0 = d3.min(domain) < 0 && d3.max(domain) > 0 ? this.labelScale(0) : null;
      const gIndicators = domain.map((val, i) => ({ val, i, value0,
        isEdgePoint: i === 0 || i === domain.length - 1,
        color: colorRange[i],
        paletteKey: paletteKeys[i],
        xMin: i - 1 < 0 ? 1 : this.labelScale(domain[i - 1]) + circleRadius * 2,
        xMax: i + 1 >= domain.length ? gradientWidth - 1 : this.labelScale(domain[i + 1]) - circleRadius * 2
      }));

      const legendDrag = d3.drag()
        .on("start", function start(d, i) {
          //click сompatible node raise
          let nextSibling = this.nextSibling;
          while (nextSibling) {
            this.parentNode.insertBefore(nextSibling, this);
            nextSibling = this.nextSibling;
          }

          const circle = d3.select(this);
          let dragged = false;
          let ghostCircle = null;

          if (d.isEdgePoint) {
            ghostCircle = circle.clone().lower().classed("ghost", true).style("opacity", 0.8);
          }

          circle.classed("dragging", true);

          d3.event.on("drag", drag).on("end", end);

          function drag(d) {
            if (d3.event.x < 0) return;
            if (d3.event.x > gradientWidth) return;
            if (d3.event.x < d.xMin || d3.event.x > d.xMax) return;
            if (!dragged && d3.event.dx !== 0) dragged = true;

            d.x = d3.event.x;
            if (d.value0 !== null) {
              d.x = (d.x < d.value0 - 3 || d.x > d.value0 + 3) ? d.x : d.value0;
            }

            circle.attr("cx", d.x);

            if (dragged) {
              const newValue = _this.labelScale.invert(d.x);
              const paletteKey = +_this.paletteScaleLinear(_this.domainScale(newValue));
              _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue(newValue));

              colorModel.palette.setColor(d.color, "" + paletteKey, !d.isEdgePoint ? "" + d.paletteKey : "-1", false);
              d.val = newValue;

              if (d.isEdgePoint && d.paletteKey !== paletteKey) d.isEdgePoint = false;

              d.paletteKey = paletteKey;
            }
          }

          function end(d) {
            circle.classed("dragging", false);
            if (ghostCircle) ghostCircle.remove();

            if (dragged) {
              let snapX = null;

              if (d.x < (circleRadius * 2)) {
                snapX = d.x < circleRadius ? 0 : (circleRadius * 2);
              } else if (d.x > (gradientWidth - circleRadius * 2)) {
                snapX = d.x > (gradientWidth - circleRadius) ? gradientWidth : (gradientWidth - circleRadius * 2);
              }

              utils.defer(() => {
                if (snapX !== null) {
                  const newValue = _this.labelScale.invert(snapX);
                  const paletteKey = +_this.paletteScaleLinear(_this.domainScale(newValue));
                  colorModel.palette.setColor(d.color, "" + paletteKey, "" + d.paletteKey, false, false);
                  colorModel.palette.setColor(d.color, "" + paletteKey, "" + d.paletteKey, true, true);
                } else {
                  colorModel.palette.setColor(d.color, "" + d.paletteKey, null, true, true);
                }
              });
            }
          }
        });

      let dblclick = false;
      let lastClickId;

      this.rainbowLegend = this.DOM.rainbowLegendG.selectAll("circle")
        .data(gIndicators, d => d.i);
      this.rainbowLegend.exit().remove();
      this.rainbowLegend = this.rainbowLegend.enter().append("circle")
        .attr("r", circleRadius + "px")
        .attr("stroke", "#000")
        .on("mouseenter", d => {
          _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue(d.val));
        })
        .on("mouseleave", () => {
          _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue("none"));
        })
        .on("click", (d, i) => {
          const d3event = { pageX: d3.event.pageX, pageY: d3.event.pageY };
          lastClickId = setTimeout(() => {
            if (!dblclick) _this._interact().clickToChangeColor(d, i, null, d3event);
            else {
              clearTimeout(lastClickId);
              dblclick = false;
            }
          }, 500);
        })
        .on("dblclick", d => {
          dblclick = true;
          if (d.isEdgePoint) return;
          utils.defer(() => {
            colorModel.palette.setColor(null, null, "" + d.paletteKey, true, true);
          });
        })
        .call(legendDrag)
        .merge(this.rainbowLegend);

      this.rainbowLegend.each(function(d, i) {
        d3.select(this).attr("fill", d.color);
        d3.select(this).attr("cx", d.x = _this.labelScale(d.val));
      });
    }

  }

}












const _ColorLegend = {

  init(config, context) {
    const _this = this;
    this.template = '<div class="vzb-cl-outer"></div>';
    this.name = "colorlegend";

    this.model_expects = [{
      name: "time",
      type: "time"
    }, {
      name: "entities",
      type: "entities"
    }, {
      name: "marker",
      type: "marker"
    }, {
      name: "color",
      type: "color"
    }, {
      name: "locale",
      type: "locale"
    }, {
      name: "ui",
      type: "ui",
    }];

    this.model_binds = {
      "change:color.scaleType": function(evt, path) {
        if (!_this._readyOnce || _this.colorModel.scale.isDiscrete()) return;
        _this.updateView();
      },
      "change:color.palette": function(evt, path) {
        if (!_this._readyOnce || (_this.colorModel.scale.isDiscrete() && !_this.frame && !_this.colorModel.use === "constant")) return;
        _this.updateView();
      },
      "change:marker.highlight": function(evt, values) {
        if (!_this.colorModel.scale.isDiscrete()) return;

        _this.model.marker.getFrame(_this.model.time.value, frame => {
          if (frame) {
            const _hlEntities = _this.model.marker.getHighlighted(_this.KEY);
            _this.updateGroupsOpacity(_hlEntities.map(d => frame[_this.colorModel._name][d]));
          } else {
            _this.updateGroupsOpacity();
          }
        });
      },
      "change:time.start": function(evt, original) {
        if (!_this._readyOnce || _this.model.time.splash) return;
        if (_this.colorModel.which == _this.model.time.dim) {
          _this.ready();
        }
      },
      "change:time.end": function(evt, original) {
        if (!_this._readyOnce || _this.model.time.splash) return;
        if (_this.colorModel.which == _this.model.time.dim) {
          _this.ready();
        }
      },
      "translate:locale": function() {
        _this._translateSelectDialog(_this.translator);
        _this.colorPicker.translate(_this.translator);
        if (_this.colorModel.use === "constant") _this._translateListLegend();
      }
    };

    //contructor is the same as any component
    this._super(config, context);
  },

  readyOnce() {
    this.translator = this.model.locale.getTFunction();

    //make color in options scrollable
    d3.select(this.placeholder.parentNode).classed("vzb-dialog-scrollable", true);

    this.colorModel = this.model.color;
    this.colorlegendMarker = this.colorModel.getClosestModel("marker_colorlegend");
    if (this.colorlegendMarker) this.colorlegendMarker.on("ready", this.ready.bind(this));


    this._initDOMElements();
    this.colorPicker = new ColorPicker(utils.isArray(this.root.element) ? this.root.element : d3.select(this.root.element));

    this.colorPicker.translate(this.translator);
    this._initSelectDialog();
  },

  _initDOMElements() {
    this.element = d3.select(this.element);
    this.DOM.wrapper = this.element.append("div").attr("class", "vzb-cl-holder");
    this.DOM.listColors = this.DOM.wrapper.append("div").attr("class", "vzb-cl-colorlist");
    this.DOM.rainbow = this.DOM.wrapper.append("div").attr("class", "vzb-cl-rainbow");
    this.DOM.rainbowCanvas = this.DOM.rainbow.append("canvas");
    this.DOM.minimap = this.DOM.wrapper.append("div").attr("class", "vzb-cl-minimap");
    this.DOM.rainbowLegend = this.DOM.wrapper.append("div").attr("class", "vzb-cl-rainbow-legend");
    this.DOM.rainbowLegendSVG = this.DOM.rainbowLegend.append("svg");
    this.DOM.rainbowLegendG = this.DOM.rainbowLegendSVG.append("g");
    this.DOM.rainbowLegendG.append("rect");
    this.rainbowLegend = null;

    this.DOM.labelScale = this.DOM.wrapper.append("div").attr("class", "vzb-cl-labelscale");
    this.DOM.labelScaleSVG = this.DOM.labelScale.append("svg");
    this.DOM.labelScaleG = this.DOM.labelScaleSVG.append("g");
    this.DOM.subtitleDiv = this.DOM.wrapper.append("div").attr("class", "vzb-cl-subtitle");
    this.DOM.subtitleText = this.DOM.subtitleDiv.append("span").attr("class", "vzb-cl-subtitle-text");

    this.DOM.minimapSVG = this.DOM.minimap.append("svg");
    this.DOM.minimapG = this.DOM.minimapSVG.append("g");
  },

  _initSelectDialog() {
    this.moreOptionsHint = this.DOM.wrapper.append("span")
      .classed("vzb-cl-more-hint vzb-hidden", true);

    this.selectDialog = this.DOM.wrapper.append("div").classed("vzb-cl-select-dialog vzb-hidden", true);
    this._initSelectDialogItems();
    this._translateSelectDialog(this.translator);
  },

  _initSelectDialogItems() {
    this.selectDialogTitle = this.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-title", true);

    this.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-close", true)
      .html(iconClose)
      .on("click", () => this._closeSelectDialog());

    this.selectAllButton = this.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-item", true);

    this.removeElseButton = this.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-item", true);

    this.editColorButton = this.selectDialog.append("div")
      .classed("vzb-cl-select-dialog-item vzb-cl-select-dialog-item-moreoptions", true);

    this.editColorButtonTooltip = this.editColorButton.append("div")
      .classed("vzb-cl-select-dialog-item-tooltip", true);
  },

  _translateSelectDialog(t) {
    this.moreOptionsHint.text(t("hints/color/more"));
    this.selectAllButton.text("✅ " + t("dialogs/color/select-all"));
    this.removeElseButton.text("🗑️ " + t("dialogs/color/remove-else"));
    this.editColorButton.text("🎨 " + t("dialogs/color/edit-color"));
    this.editColorButtonTooltip.text(t("dialogs/color/edit-color-blocked-hint"));
  },

  _closeSelectDialog() {
    this.selectDialog.classed("vzb-hidden", true);
  },

  _bindSelectDialogItems(...args) {
    const [, index, indicators] = args;
    this.selectDialogTitle.text(indicators[index].textContent);

    this.selectAllButton.on("click", () => {
      this._interact().clickToSelect(...args);
      this._closeSelectDialog();
    });

    this.removeElseButton.on("click", () => {
      this._interact().clickToShow(...args);
      this._closeSelectDialog();
    });

    this.editColorButton.on("click", () => {
      this._interact().clickToChangeColor(...args);
      this._closeSelectDialog();
    });
  },

  ready() {
    this.KEYS = utils.unique(this.model.marker._getAllDimensions({ exceptType: "time" }));
    this.KEY = this.colorModel._getFirstDimension();
    this.markerArray = this.model.marker.getKeys();
    this.which = this.colorModel.which;
    this.canShowMap = false;
    this.colorlegendMarkerArray = [];
    this.legendHasOwnModel = ["entity_set", "entity_domain"]
      .includes(this.colorModel.getConceptprops().concept_type);

    if (this.legendHasOwnModel && this.colorlegendMarker) {
      if (!this.colorlegendMarker._ready) return;

      this.which = this.colorlegendMarker.getFirstEntityModel().getDimension();

      this.colorlegendMarker.getFrame(this.model.time.value, frame => {
        if (!frame) return utils.warn("colorlegend received empty frame in ready()");
        this.frame = frame;
        this.canShowMap = utils.keys((this.frame || {}).hook_geoshape || {}).length;

        this.colorlegendMarkerArray = this.colorlegendMarker.getKeys(this.which);

        this.colorlegendMarkerArray.forEach(d => {
          if (!((this.frame || {}).hook_geoshape || {})[d[this.which]]) this.canShowMap = false;
        });
        this.updateView();
        this.updateGroupsOpacity();
      });
    } else {
      this.updateView();
      this.updateGroupsOpacity();
    }
  },


  updateView() {
    if (!this.element.selectAll) return utils.warn("colorlegend resize() aborted because element is not yet defined");


    /*POSSIBLE VIEWS:
    Rainbow color legend (for countinuous indicators and properties)
    Minimap color legend (for discrete properties where shapes are available via CL marker model)
    List color legend (for other discarete indicators and properties)
      - one constant
      - list of individual colors for every color legend mark (every country is own color)
      - list of colors informed by CL marker model (world regions)
      - colors informed by scale (discrete indicators such as one in legal slavery case: legal/illegal switches over time)
    */

    //Hide color legend if using a discrete palette that would map to all entities on the chart and therefore will be too long
    //in this case we should show colors in the "find" list instead
    const individualColors = this.colorlegendMarker
      && this.which == this.KEY
      && utils.comparePlainObjects(this.colorlegendMarker.getFirstEntityModel().getFilter(), this.model.entities.getFilter());

    this.DOM.subtitleDiv.classed("vzb-hidden", true);

    this._updateRainbowLegend(!this.colorModel.scale.isDiscrete());
    this._updateListLegend(this.colorModel.scale.isDiscrete() && !this.canShowMap && !individualColors);
    this._updateMinimapLegend(this.colorModel.scale.isDiscrete() && this.canShowMap);

    this._updateSelectDialog();
  },


  _updateListLegend(isVisible) {

    this.DOM.listColors.classed("vzb-hidden", !isVisible);
    if (!isVisible) return;

    const KEY = this.KEY;
    const _this = this;
    const cScale = this.colorModel.getScale();

    let colorOptionsArray = [];

    if (this.colorlegendMarkerArray.length) {
      colorOptionsArray = this.which == KEY ? this.markerArray : this.colorlegendMarkerArray;
    } else {
      colorOptionsArray = cScale.domain().map(value => {
        const result = {};
        result[this.which] = value;
        return result;
      });
    }

    let colorOptions = this.DOM.listColors.selectAll(".vzb-cl-option")
      .data(utils.unique(colorOptionsArray, d => d[this.which]), d => d[this.which]);

    colorOptions.exit().remove();

    colorOptions = colorOptions.enter().append("div").attr("class", "vzb-cl-option")
      .each(function() {
        d3.select(this).append("div").attr("class", "vzb-cl-color-sample");
        d3.select(this).append("div").attr("class", "vzb-cl-color-legend");
      })
      .on("mouseover", _this._interact().mouseover)
      .on("mouseout", _this._interact().mouseout)
      .on("click", (...args) => {
        if (_this.legendHasOwnModel) {
          this._bindSelectDialogItems(...args);
          this.selectDialog.classed("vzb-hidden", false);
        } else {
          this._interact().clickToChangeColor(...args);
        }
      })
      .merge(colorOptions);

    colorOptions.each(function(d, index) {
      d3.select(this).select(".vzb-cl-color-sample")
        .style("background-color", cScale(d[_this.which]))
        .style("border", "1px solid " + cScale(d[_this.which]));
      //Apply names to color legend entries if color is a property
      let label = _this.colorlegendMarker && _this.frame ? _this.frame.label[d[_this.which]] : null;
      if (!label && label !== 0) label = d[_this.which];
      if (_this.colorModel.use === "constant") label = _this.translator("indicator/_default/color");
      d3.select(this).select(".vzb-cl-color-legend").text(label);
    });
  },

  _translateListLegend() {
    this.DOM.listColors.select(".vzb-cl-option .vzb-cl-color-legend").text(this.translator("indicator/_default/color"));
  },

  _updateMinimapLegend(isVisible) {

    this.DOM.minimap.classed("vzb-hidden", !isVisible);
    if (!isVisible) return;

    const _this = this;
    const cScale = this.colorModel.getScale();

    const tempdivEl = this.DOM.minimap.append("div").attr("class", "vzb-temp");

    this.DOM.minimapSVG.attr("viewBox", null);
    this.DOM.minimapSVG.selectAll("g").remove();
    this.DOM.minimapG = this.DOM.minimapSVG.append("g");
    this.DOM.minimapG.selectAll("path")
      .data(this.colorlegendMarkerArray, d => d[this.which])
      .enter().append("path")
      .on("mouseover", this._interact().mouseover)
      .on("mouseout", this._interact().mouseout)
      .on("click", (...args) => {
        this._bindSelectDialogItems(...args);
        this.selectDialog.classed("vzb-hidden", false);
      })
      .each(function(d) {
        let shapeString = _this.frame.hook_geoshape[d[_this.which]].trim();

        //check if shape string starts with svg tag -- then it's a complete svg
        if (shapeString.slice(0, 4) == "<svg") {
          //append svg element from string to the temporary div
          tempdivEl.html(shapeString);
          //replace the shape string with just the path data from svg
          //TODO: this is not very resilient. potentially only the first path will be taken!
          shapeString = tempdivEl.select("svg").select("path").attr("d");
        }

        d3.select(this)
          .attr("d", shapeString)
          .style("fill", cScale(d[_this.which]))
          .append("title").text(_this.frame.label[d[_this.which]]);

        tempdivEl.html("");
      });

    const gbbox = this.DOM.minimapG.node().getBBox();
    this.DOM.minimapSVG.attr("viewBox", "0 0 " + gbbox.width * 1.05 + " " + gbbox.height * 1.05);
    tempdivEl.remove();

  },


  _updateRainbowLegend(isVisible) {
    const _this = this;

    //Hide rainbow element if showing minimap or if color is discrete
    this.DOM.rainbow.classed("vzb-hidden", !isVisible);
    this.DOM.labelScale.classed("vzb-hidden", !isVisible);
    this.DOM.rainbowLegend.classed("vzb-hidden", !isVisible);
    if (!isVisible) return;

    const gradientWidth = this.DOM.rainbow.node().getBoundingClientRect().width;
    const paletteKeys = Object.keys(this.colorModel.getPalette()).sort((a, b) => a - b).map(parseFloat);
    const cScale = this.colorModel.getScale();
    const circleRadius = 6;

    let domain;
    let range;
    const formatter = this.colorModel.getTickFormatter();
    let fitIntoScale = null;

    const paletteLabels = this.colorModel.paletteLabels;

    if (paletteLabels) {

      fitIntoScale = "optimistic";

      domain = paletteLabels.map(val => parseFloat(val));
      const paletteMax = d3.max(domain);
      range = domain.map(val => val / paletteMax * gradientWidth);

    } else {

      domain = cScale.domain();
      const paletteMax = d3.max(paletteKeys);
      range = paletteKeys.map(val => val / paletteMax * gradientWidth);

    }

    const labelScaleType = (d3.min(domain) <= 0 && d3.max(domain) >= 0 && this.colorModel.scaleType === "log") ? "genericLog" : this.colorModel.scaleType;

    this.labelScale = cScale.copy()
      .interpolate(d3.interpolate)
      .range(range);

    const marginLeft = parseInt(this.DOM.rainbow.style("left"), 10) || 0;
    const marginRight = parseInt(this.DOM.rainbow.style("right"), 10) || marginLeft;

    this.DOM.labelScaleSVG.style("width", marginLeft + gradientWidth + marginRight + "px");
    this.DOM.labelScaleG.attr("transform", "translate(" + marginLeft + ",2)");
    this.labelsAxis = axisSmart("bottom");
    this.labelsAxis.scale(this.labelScale)
      //.tickFormat(formatter)
      .tickSizeOuter(5)
      .tickPadding(8)
      .tickSizeMinor(3, -3)
      .labelerOptions({
        scaleType: this.colorModel.scaleType,
        toolMargin: {
          right: marginRight,
          left: marginLeft
        },
        showOuter: false,
        formatter,
        bump: marginLeft,
        cssFontSize: "8px",
        fitIntoScale
      });

    this.DOM.labelScaleG.call(this.labelsAxis);

    this.DOM.rainbowCanvas
      .attr("width", gradientWidth)
      .attr("height", 1)
      .style("width", gradientWidth + "px")
      .style("height", "100%");

    const context = this.DOM.rainbowCanvas.node().getContext("2d");
    const image = context.createImageData(gradientWidth, 1);
    for (let i = 0, j = -1, c; i < gradientWidth; ++i) {
      c = d3.rgb(cScale(this.labelScale.invert(i)));
      image.data[++j] = c.r;
      image.data[++j] = c.g;
      image.data[++j] = c.b;
      image.data[++j] = 255;
    }
    context.putImageData(image, 0, 0);

    const conceptProps = this.colorModel.getConceptprops();
    const subtitle = utils.getSubtitle(conceptProps.name, conceptProps.name_short);

    this.DOM.subtitleDiv.classed("vzb-hidden", subtitle == "");
    this.DOM.subtitleText.text(subtitle);

    //rainbow legend setup
    if (this.DOM.rainbowLegend.style("display") !== "none") {
      const edgeDomain = d3.extent(domain);

      this.domainScale = this.labelScale.copy()
        .domain(edgeDomain)
        .range(edgeDomain);

      this.paletteScaleLinear = d3.scaleLinear().domain(edgeDomain).range([0, 100]);

      this.DOM.rainbowLegendSVG.style("width", marginLeft + gradientWidth + marginRight + "px");
      this.DOM.rainbowLegendG.attr("transform", "translate(" + marginLeft + ", " + 7 + ")");

      this.DOM.labelScale.selectAll(".vzb-axis-value text").attr("dy", "1.5em");

      if (!edgeDomain.includes(0)) {
        //find tick with zero
        const zeroTickEl = this.DOM.labelScaleG.selectAll(".tick text").filter(function() { return d3.select(this).text() === "0"; })
          .style("cursor", "pointer")
          .on("dblclick", () => {
            const color = cScale(0);
            const paletteKey = +_this.paletteScaleLinear(_this.domainScale(0));
            _this.colorModel.setColor(color, "" + paletteKey, null, true, true);
          });
      }

      this.DOM.rainbowLegendG.select("rect")
        .attr("width", gradientWidth)
        .attr("height", 20)
        .on("mousemove", function() {
          _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue(_this.labelScale.invert(d3.mouse(this)[0])));
        })
        .on("mouseleave", () => _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue("none")))
        .on("dblclick", function() {
          let x = d3.mouse(this)[0];
          x = x <= (circleRadius * 2) ? circleRadius * 2 : x >= (gradientWidth - circleRadius * 2) ? gradientWidth - circleRadius * 2 : x;
          const newValue = _this.labelScale.invert(x);
          const color = cScale(newValue);
          const paletteKey = _this.paletteScaleLinear(_this.domainScale(newValue));
          _this.colorModel.setColor(color, "" + paletteKey, null, true, true);
        });

      const colorRange = cScale.range();

      const value0 = d3.min(domain) < 0 && d3.max(domain) > 0 ? this.labelScale(0) : null;
      const gIndicators = domain.map((val, i) => ({ val, i, value0,
        isEdgePoint: i === 0 || i === domain.length - 1,
        color: colorRange[i],
        paletteKey: paletteKeys[i],
        xMin: i - 1 < 0 ? 1 : this.labelScale(domain[i - 1]) + circleRadius * 2,
        xMax: i + 1 >= domain.length ? gradientWidth - 1 : this.labelScale(domain[i + 1]) - circleRadius * 2
      }));

      const legendDrag = d3.drag()
        .on("start", function start(d, i) {
          //click сompatible node raise
          let nextSibling = this.nextSibling;
          while (nextSibling) {
            this.parentNode.insertBefore(nextSibling, this);
            nextSibling = this.nextSibling;
          }

          const circle = d3.select(this);
          let dragged = false;
          let ghostCircle = null;

          if (d.isEdgePoint) {
            ghostCircle = circle.clone().lower().classed("ghost", true).style("opacity", 0.8);
          }

          circle.classed("dragging", true);

          d3.event.on("drag", drag).on("end", end);

          function drag(d) {
            if (d3.event.x < 0) return;
            if (d3.event.x > gradientWidth) return;
            if (d3.event.x < d.xMin || d3.event.x > d.xMax) return;
            if (!dragged && d3.event.dx !== 0) dragged = true;

            d.x = d3.event.x;
            if (d.value0 !== null) {
              d.x = (d.x < d.value0 - 3 || d.x > d.value0 + 3) ? d.x : d.value0;
            }

            circle.attr("cx", d.x);

            if (dragged) {
              const newValue = _this.labelScale.invert(d.x);
              const paletteKey = +_this.paletteScaleLinear(_this.domainScale(newValue));
              _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue(newValue));

              _this.colorModel.setColor(d.color, "" + paletteKey, !d.isEdgePoint ? "" + d.paletteKey : "-1", false);
              d.val = newValue;

              if (d.isEdgePoint && d.paletteKey !== paletteKey) d.isEdgePoint = false;

              d.paletteKey = paletteKey;
            }
          }

          function end(d) {
            circle.classed("dragging", false);
            if (ghostCircle) ghostCircle.remove();

            if (dragged) {
              let snapX = null;

              if (d.x < (circleRadius * 2)) {
                snapX = d.x < circleRadius ? 0 : (circleRadius * 2);
              } else if (d.x > (gradientWidth - circleRadius * 2)) {
                snapX = d.x > (gradientWidth - circleRadius) ? gradientWidth : (gradientWidth - circleRadius * 2);
              }

              utils.defer(() => {
                if (snapX !== null) {
                  const newValue = _this.labelScale.invert(snapX);
                  const paletteKey = +_this.paletteScaleLinear(_this.domainScale(newValue));
                  _this.colorModel.setColor(d.color, "" + paletteKey, "" + d.paletteKey, false, false);
                  _this.colorModel.setColor(d.color, "" + paletteKey, "" + d.paletteKey, true, true);
                } else {
                  _this.colorModel.setColor(d.color, "" + d.paletteKey, null, true, true);
                }
              });
            }
          }
        });

      let dblclick = false;
      let lastClickId;

      this.rainbowLegend = this.DOM.rainbowLegendG.selectAll("circle")
        .data(gIndicators, d => d.i);
      this.rainbowLegend.exit().remove();
      this.rainbowLegend = this.rainbowLegend.enter().append("circle")
        .attr("r", circleRadius + "px")
        .attr("stroke", "#000")
        .on("mouseenter", d => {
          _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue(d.val));
        })
        .on("mouseleave", () => {
          _this.DOM.labelScaleG.call(_this.labelsAxis.highlightValue("none"));
        })
        .on("click", (d, i) => {
          const d3event = { pageX: d3.event.pageX, pageY: d3.event.pageY };
          lastClickId = setTimeout(() => {
            if (!dblclick) _this._interact().clickToChangeColor(d, i, null, d3event);
            else {
              clearTimeout(lastClickId);
              dblclick = false;
            }
          }, 500);
        })
        .on("dblclick", d => {
          dblclick = true;
          if (d.isEdgePoint) return;
          utils.defer(() => {
            _this.colorModel.setColor(null, null, "" + d.paletteKey, true, true);
          });
        })
        .call(legendDrag)
        .merge(this.rainbowLegend);

      this.rainbowLegend.each(function(d, i) {
        d3.select(this).attr("fill", d.color);
        d3.select(this).attr("cx", d.x = _this.labelScale(d.val));
      });
    }

  },

  _updateSelectDialog() {
    const isColorSelectable = this.colorModel.isUserSelectable();
    this.editColorButtonTooltip.classed("vzb-hidden", isColorSelectable);
    this.editColorButton.classed("vzb-cl-select-dialog-item-disabled", !isColorSelectable);

    this.selectDialog.classed("vzb-hidden", true);
  },

  _highlight(values) {
    utils.getProp(this, ["model", "ui", "chart", "superhighlightOnMinimapHover"]) ?
      this.model.marker.setSuperHighlight(values) :
      this.model.marker.setHighlight(values);
  },

  _unhighlight() {
    utils.getProp(this, ["model", "ui", "chart", "superhighlightOnMinimapHover"]) ?
      this.model.marker.clearSuperHighlighted() :
      this.model.marker.clearHighlighted();
  },

  _interact() {
    const _this = this;
    const KEYS = this.KEYS;
    const KEY = this.KEY;
    const which = this.which;

    return {
      mouseover(d, i) {
        _this.moreOptionsHint.classed("vzb-hidden", false);
        //disable interaction if so stated in concept properties
        if (!_this.colorModel.scale.isDiscrete()) return;

        const view = d3.select(this);
        const target = d[which];

        if (_this.colorModel.use == "indicator") {
          _this.model.marker.getFrame(_this.model.time.value, frame => {
            if (!frame) return;

            const filterHash = Object.keys(frame[_this.colorModel._name]).filter(key => frame[_this.colorModel._name][key] == target)
              .reduce((result, key) => {
                result[key] = true;
                return result;
              }, {});

            _this._highlight(_this.markerArray.filter(d => filterHash[utils.getKey(d, _this.colorModel.getDataKeys())]));
          });
        } else if (_this.colorModel.use == "property") {
          const filterHash = _this.colorModel.getValidItems()
            //filter so that only countries of the correct target remain
            .filter(f => f[_this.colorModel.which] == target)
            .reduce((result, d) => {
              result[d[KEY]] = true;
              return result;
            }, {});

          _this._highlight(_this.markerArray.filter(key => filterHash[key[KEY]]));
        } else {
          // in case of constant do nothing
        }
      },

      mouseout(d, i) {
        _this.moreOptionsHint.classed("vzb-hidden", true);
        //disable interaction if so stated in concept properties
        if (!_this.colorModel.scale.isDiscrete()) return;
        _this._unhighlight();
      },
      clickToChangeColor(d, i, group, d3event = d3.event) {
        //disable interaction if so stated in concept properties
        if (!_this.colorModel.isUserSelectable()) return;
        const palette = _this.colorModel.getPalette();
        const defaultPalette = _this.colorModel.getDefaultPalette();
        const view = d3.select(this);
        const target = !_this.colorModel.scale.isDiscrete() ? d.paletteKey : d[which];
        _this.colorPicker
          .colorOld(palette[target])
          .colorDef(defaultPalette[target])
          .callback((value, isClick) => _this.colorModel.setColor(value, "" + target, null, isClick, isClick))
          .fitToScreen([d3event.pageX, d3event.pageY])
          .show(true);
      },
      clickToShow(d, i) {
        //disable interaction if so stated in concept properties
        if (!_this.colorModel.scale.isDiscrete()) return;

        const view = d3.select(this);
        const target = d[which];

        const oldShow = _this.model.entities.show[which] && _this.model.entities.show[which]["$in"] ?
          utils.clone(_this.model.entities.show[which]["$in"]) :
          [];

        const entityIndex = oldShow.indexOf(d[which]);
        if (entityIndex !== -1) {
          oldShow.splice(entityIndex, 1);
        } else {
          oldShow.push(d[which]);
        }

        const show = {};
        if (oldShow.length > 0)
          show[which] = { "$in": oldShow };

        _this.model.entities.set({ show });

      },
      clickToSelect(d, i) {
        //disable interaction if so stated in concept properties
        if (!_this.colorModel.scale.isDiscrete()) return;

        const view = d3.select(this);
        const target = d[which];

        const filterHash = _this.colorModel.getValidItems()
          //filter so that only countries of the correct target remain
          .filter(f => f[_this.colorModel.which] == target)
          //fish out the "key" field, leave the rest behind
          .reduce((result, d) => {
            result[d[KEY]] = true;
            return result;
          }, {});

        const select = _this.markerArray.filter(f => filterHash[f[KEY]])
          .map(d => utils.clone(d, KEYS));

        if (select.filter(d => _this.model.marker.isSelected(d)).length == select.length) {
          _this.model.marker.clearSelected();
        } else {
          _this.model.marker.setSelect(select);
        }
      }
    };
  },

  resize() {
    this.updateView();
    this.colorPicker.resize(d3.select(".vzb-colorpicker-svg"));
  },

  /**
   * Function updates the opacity of color legend elements
   * @param   {Array} value = [] array of highlighted elements
   */
  updateGroupsOpacity(highlight = []) {
    const _this = this;

    const clMarker = this.colorlegendMarker || {};
    const OPACITY_REGULAR = clMarker.opacityRegular || 0.8;
    const OPACITY_DIM = clMarker.opacityHighlightDim || 0.5;
    const OPACITY_HIGHLIGHT = 1;

    const selection = _this.canShowMap ? ".vzb-cl-minimap path" : ".vzb-cl-colorlist .vzb-cl-option .vzb-cl-color-sample";

    this.DOM.wrapper.selectAll(selection).style("opacity", d => {
      if (!highlight.length) return OPACITY_REGULAR;
      return highlight.indexOf(d[_this.which]) > -1 ? OPACITY_HIGHLIGHT : OPACITY_DIM;
    });
  }

}
