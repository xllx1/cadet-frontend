(function(exports) {
  /**
   * Setup Stage
   */
  var stage;
  var container = document.createElement('div');
  container.id = 'env-visualizer-container';
  container.hidden = true;
  document.body.appendChild(container);
  // create viewport
  var viewport = new Concrete.Viewport({
    width: 1000,
    height: 1000,
    container: container
  });
  const frameFontSetting = '14px Roboto Mono, Courier New';
  const FNOBJECT_RADIUS = 12; // radius of function object circle
  const DATA_OBJECT_SIDE = 24; // length of data object triangle
  const DRAWING_LEFT_PADDING = 50; // left padding for entire drawing
  const FRAME_HEIGHT_LINE = 55; // height in px of each line of text in a frame;
  const FRAME_HEIGHT_PADDING = 20; // height in px to pad each frame with
  const FRAME_WIDTH_CHAR = 8; // width in px of each text character in a frame;
  const FRAME_WIDTH_PADDING = 50; // width in px to pad each frame with;
  const FRAME_SPACING = 100; // spacing between horizontally adjacent frames
  const LEVEL_SPACING = 60; // spacing between vertical frame levels
  const OBJECT_FRAME_RIGHT_SPACING = 50; // space to right frame border
  const OBJECT_FRAME_TOP_SPACING = 35; // perpendicular distance to top border
  const PAIR_SPACING = 15;

  // TEXT SPACING 
  const HORIZONTAL_TEXT_MARGIN = 10
  const VERITCAL_TEXT_MARGIN = 39

  // DATA STRUCTURE DIMENSIONS
  const DATA_UNIT_WIDTH = 80;
  const DATA_UNIT_HEIGHT = 40;


  
  /**
   * Keys (unique IDs) for data objects, user-defined function objects,
   * and built-in function objects must all be differentiated.
   * dataObject and builtinFnObject keys need to be manually assigned.
   * Since ConcreteJS hit detection uses [0, 2^24) as its range of keys
   * (and -1 for not found), take 2^24 - 1 as the key for
   * the first dataObject and decrement from there.
   * Take 2^23 - 1 as the key for the first builtinFnObject and
   * decrement from there.
   */
  let dataObjectKey = Math.pow(2, 24) - 1;
  let fnObjectKey = Math.pow(2, 22) - 1;
  
  // Initialise list of built-in functions to ignore (i.e. not draw)
  var builtins = [];
  
  /**
   * Helper functions for drawing different types of elements on the canvas.
   */
  function checkSubStructure(d1, d2) {
    // d1 and d2 are 2 dataObjects, check if d2 is identical to d1
    // or a sub data structure of d1
    if (!Array.isArray(d1)) {
      if(isFunction(d1) && isFunction(d2) && d1 == d2) {
        return true;
      } else {
        return false;
      }
    } else if (d2 === d1) {
      return true;
    } else if(d1.length == 2) {
      return checkSubStructure(d1[0], d2)
        || checkSubStructure(d1[1], d2);
    } else {
      let containsSubStructure = false;
      for(let i = 0; !containsSubStructure && i < d1.length; i++) {
        containsSubStructure = checkSubStructure(d1[i], d2)
      }
      return containsSubStructure;
    }
  }

  function getShiftInfo(d1, d2) {
    // given that d2 is a sub structure of d1, return a coordinate object
    // to indicate the x and y coordinate with respect to d1
    const result = {
      x: dataObjectWrappers[dataObjects.indexOf(d1)].x,
      y: dataObjectWrappers[dataObjects.indexOf(d1)].y + 3/4 * DATA_UNIT_HEIGHT
    }

    // If parent object, point to placeholder object rather than within object
    if(d1.length != 2) {
      return result;
    }

    while (d2 !== d1) {
      if (checkSubStructure(d1[0], d2)) {
        // Add the height of the tail of d1 to the y-coordinate
        rightHeight = getBasicUnitHeight(d1[1]);
        d1 = d1[0];
        result.y += (rightHeight + 1) * (DATA_UNIT_HEIGHT + PAIR_SPACING);
      } else {
        d1 = d1[1];
        result.x += DATA_UNIT_WIDTH + PAIR_SPACING;
      }
    }
    return result;
  }

  function drawThis(dataObject) {
    // returns a structure that contains a boolean to indicate whether 
    // or not to draw dataObject. If boolean is false, also returns the main
    // and substructure that is involved
    const result = {
      draw: true,
      mainStructure: null,
      subStructure: null
    }
    for (d in drawnDataObjects) {
      if (checkSubStructure(drawnDataObjects[d], dataObject)) {
        result.draw = false;
        result.mainStructure = drawnDataObjects[d];
        result.subStructure = dataObject;
        return result;
      }
    }
    return result;
  }

  function drawArrow(context, x0, y0, xf, yf) {
    context.save();
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(xf, yf);
    // draw arrow head
    drawArrowHead(context, x0, y0, xf, yf);
    context.stroke();
  }

  function reassignCoordinates(d1, d2) {
    // if we do not need to draw d2, reassign x and y coordinates to 
    // be the corresponding coordinates of d1
    const trueCoordinates = getShiftInfo(d1, d2);
    const wrapper = dataObjectWrappers[dataObjects.indexOf(d2)];
    wrapper.x = trueCoordinates.x;
    wrapper.y = trueCoordinates.y;
  }

  function drawSceneFnObjects() {
    fnObjectLayer.scene.clear();
    for (let i = 0; i < fnObjects.length; i++) {
      const fnObjParent = fnObjects[i].parent
      if(Array.isArray(fnObjParent) && fnObjParent[0].length != 2) {
        // Do not draw function if it belongs to an array. (Remove after implementing arrays)
      } else {
        drawSceneFnObject(i);
      }
    }
    viewport.render();
  }

  function drawHitFnObjects() {
    for (let i = 0; i < fnObjects.length; i++) {
      drawHitFnObject(i);
    }
  }

  function drawSceneDataObjects() {
    // drawDataObjects array is declared as a global array below but must 
    // be reset whenever this fn is called
    drawnDataObjects = [];
    dataObjectLayer.scene.clear();
    dataObjects.forEach(function(dataObject) {
      if (dataObject != null) {
        const result = drawThis(dataObject);
        const draw = result.draw;
        if (draw) {
          if(is_Array(dataObject)){
            drawArrayObject(dataObject);
          } else {
            drawSceneDataObject(dataObject);
          }
          drawnDataObjects.push(dataObject);
        } else {
          reassignCoordinates(result.mainStructure, result.subStructure);
        }
      } 
    });
    viewport.render();
  }

  function drawHitDataObjects() {
    dataObjects.forEach(function(dataObject) {
      if (dataObject != null) {
        drawHitDataObject(dataObject);
      }
    });
  }

  function drawSceneFrames() {
    frames.forEach(function(frame) {
      if (!isEmptyFrame(frame)) {
        drawSceneFrame(frame);
      }
    });
    viewport.render();
  }

  // For both function objects and data objects
  function drawSceneFrameObjectArrows() {
    frames.forEach(function(frame) {
      let elements = frame.elements;
      for (e in elements) {
        if (typeof elements[e] == 'function') {
          drawSceneFrameFnArrow(frame, e, elements[e]);
        } else if (typeof elements[e] == 'object' && elements[e] != null) {
          drawSceneFrameDataArrow(frame, e, elements[e]);
        }
      }
    });
    viewport.render();
  }

  function drawSceneFnFrameArrows() {
    fnObjects.forEach(function(fnObject) {
      drawSceneFnFrameArrow(fnObject);
    });
    viewport.render();
  }

  function drawSceneFrameArrows() {
    frames.forEach(function(frame) {
      if (!isEmptyFrame(frame)) {
        drawSceneFrameArrow(frame);
      }
    });
    viewport.render();
  }

  /**
   * The actual drawing functions.
   * "Scene" objects are the actual visible drawings.
   * "Hit" objects are the hitboxes (for mouseovers/clicks) for each scene.
   */
  function drawSceneFnObject(pos) {
    var config = fnObjects[pos];
    var scene = config.layer.scene,
      context = scene.context;
    const x = config.x;
    const y = config.y;
    context.fillStyle = '#2c3e50'; // colour of Source Academy background
    context.fillRect(x - 2 * FNOBJECT_RADIUS, y - FNOBJECT_RADIUS, 4 * FNOBJECT_RADIUS, 2 * FNOBJECT_RADIUS);
    context.strokeStyle = '#999999';
    context.beginPath();
    context.arc(x - FNOBJECT_RADIUS, y, FNOBJECT_RADIUS, 0, Math.PI * 2, false);

    if (!config.hovered && !config.selected) {
      context.strokeStyle = '#999999';
      context.lineWidth = 2;
      context.stroke();
    } else {
      context.strokeStyle = 'green';
      context.lineWidth = 2;
      context.stroke();
    }

    context.beginPath();
    if (config.selected) {
      context.font = '14px Roboto Mono Light, Courier New';
      context.fillStyle = 'white';
      let fnString;
      try {
        fnString = config.fun.toString();
      } catch (e) {
        fnString = config.toString();
      }
      let params;
      let body;
      if (config.node.type == "FunctionDeclaration") {
        params = fnString.substring(fnString.indexOf('('), fnString.indexOf('{') - 1);
        body = fnString.substring(fnString.indexOf('{'));
      } else {
        params = fnString.substring(0, fnString.indexOf('=') - 1);
        body = fnString.substring(fnString.indexOf('=') + 3);
      }
      body = body.split('\n');
      context.fillText(`params: ${params == '' ? '()' : params}`, x + 50, y);
      context.fillText(`body:`, x + 50, y + 20);
      let i = 0;
      while (i < 5 && i < body.length) {
        context.fillText(body[i], x + 100, y + 20 * (i + 1));
        i++;
      }
      if (i < body.length) {
        context.fillText('...', x + 120, y + 120);
      }
    }
    context.arc(x + FNOBJECT_RADIUS, y, FNOBJECT_RADIUS, 0, Math.PI * 2, false);
    context.moveTo(x + FNOBJECT_RADIUS, y);
    context.lineTo(x + FNOBJECT_RADIUS, y - FNOBJECT_RADIUS);
    context.stroke();
  }

  function drawHitFnObject(pos) {
    var config = fnObjects[pos];
    var hit = config.layer.hit,
      context = hit.context;
    const x = config.x;
    const y = config.y;
    config.x = x;
    config.y = y;
    context.save();
    context.beginPath();
    context.arc(x - FNOBJECT_RADIUS, y, FNOBJECT_RADIUS, 0, Math.PI * 2, false);
    context.fillStyle = hit.getColorFromIndex(config.key);
    context.fill();
    context.restore();

    context.beginPath();
    context.arc(x + FNOBJECT_RADIUS, y, FNOBJECT_RADIUS, 0, Math.PI * 2, false);
    context.fillStyle = hit.getColorFromIndex(config.key);
    context.fill();
    context.restore();
  }

  /**
   * Identities for data objects are not currently implemented in the
   * visualiser, so a separate icon (a triangle) is drawn for each variable
   * that points to data.
   */

   // function to determine the distance to shift the next pair
   // takes in a list data object and returns an integer

  function drawLine(context, startX, startY, endX, endY) {
    context.save();
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.closePath();
  }
  
  // since arrows across data structures will now be drawn in the arrow Layer
  // need a function calculate the coordinates the small portion of the arrow from
  // center of box to edge of box
  function inBoxCoordinates(x0, y0, xf, yf, head) {
    const distX = Math.abs(x0 - xf);
    const distY = Math.abs(y0 - yf);
    const half_width = ((xf > x0 && head) || (x0 >= xf && !head)) 
      ? (3/4) * DATA_UNIT_WIDTH
      : (1/4) * DATA_UNIT_WIDTH;
    const half_height = DATA_UNIT_HEIGHT/2;
    // asume arrows goes out from side of box instead of top
    let xFinal = xf > x0 ? x0 + half_width : x0 - half_width;
    let yFinal = y0 - (distY * (half_width/distX));
    if (yFinal < y0 - half_height) {
      // doesn't go out from side but rather from top
      yFinal = y0 - half_height;
      xFinal = xf > x0 ? x0 + (distX * (half_height/distY)) : x0 - (distX * (half_height/distY));
    } 
    return {x: xFinal, y: yFinal};
  }

  function drawScenePairs(dataObject, scene, wrapper, wrapperData, startX, startY) {
    // wrapperData is only relevant for tracing the origin of function objects in lists
    // not useful for anything else 
    var context = scene.context,
      parent = wrapper.parent;
    
    // makes an opaque rectangle of the same colour as the background
    context.fillStyle = '#2c3e50';
    context.fillRect(startX, startY, DATA_UNIT_WIDTH, DATA_UNIT_HEIGHT);
    // draws the pair shape
    context.fillStyle = '#999999';
    context.strokeRect(startX, startY, DATA_UNIT_WIDTH, DATA_UNIT_HEIGHT);
    context.beginPath();
    context.moveTo(startX + DATA_UNIT_WIDTH/2, startY);
    context.lineTo(startX + DATA_UNIT_WIDTH/2, startY + DATA_UNIT_HEIGHT);
    context.stroke();
    context.closePath();
    context.restore();
    context.font = '14px Roboto Mono Light, Courier New';
    // draws data in the head and tail
    if (Array.isArray(dataObject[0])) {
      const result = drawThis(dataObject[0]);
      const draw = result.draw;
      // check if need to draw the data object or it has already been drawn
      if (draw) {
        const shiftY = calculatePairShift(dataObject[1]);
        if (is_Array(dataObject[0])) {
          drawNestedArrayObject(startX, startY + shiftY);
        } else {
          drawScenePairs(dataObject[0], scene, wrapper, wrapperData[0], startX, startY + shiftY);
        }
        drawLine(context, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2,
          startX + DATA_UNIT_WIDTH / 4, startY + shiftY);
        context.moveTo(startX + DATA_UNIT_WIDTH / 4, startY + shiftY);
        drawArrowHead(context, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2,
          startX + DATA_UNIT_WIDTH / 4, startY + shiftY);
        context.stroke();

      } else {
        if (is_Array(dataObject[0])) {
          // declare new context so arrow drawn in the arrowLayer instead of dataObjectLayer
          const arrowContext = arrowLayer.scene.context;
          const coordinates = getShiftInfo(result.mainStructure, result.subStructure);
          const xCoord = coordinates.x - 10;
          const yCoord = coordinates.y - 10;
          // draw line from center of box to edge of box in dataObjectLayer
          const boxEdgeCoord = inBoxCoordinates(startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2, xCoord, yCoord, true);
          drawLine(context, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2, boxEdgeCoord.x, boxEdgeCoord.y);
          // draw remaining line in arrowLayer
          drawArrow(arrowContext, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2,
            xCoord, yCoord);
          // duplicate the exact same line but in the hover layer
          var hoverContext = hoveredLayer.scene.context;
          hoverContext.strokeStyle = 'white';
          drawArrow(hoverContext, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2,
            xCoord, yCoord);
        } else {
          // declare new context so arrow drawn in the arrowLayer instead of dataObjectLayer
          const arrowContext = arrowLayer.scene.context;
          const coordinates = getShiftInfo(result.mainStructure, result.subStructure);
          const xCoord = coordinates.x;
          const yCoord = coordinates.y;
          // draw line from center of box to edge of box in dataObjectLayer
          const boxEdgeCoord = inBoxCoordinates(startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2, xCoord, yCoord, true);
          drawLine(context, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2, boxEdgeCoord.x, boxEdgeCoord.y);
          // draw remaining line in arrowLayer
          drawArrow(arrowContext, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2,
            xCoord, yCoord);
          // duplicate the exact same line but in the hover layer
          var hoverContext = hoveredLayer.scene.context;
          hoverContext.strokeStyle = 'white';
          drawArrow(hoverContext, startX + DATA_UNIT_WIDTH / 4, startY + DATA_UNIT_HEIGHT / 2,
            xCoord, yCoord);
        }
      }
      
    } else if (dataObject[0] == null) {
      drawLine(context, startX + DATA_UNIT_WIDTH/2, startY, startX, startY + DATA_UNIT_HEIGHT);
    } else if (typeof wrapperData[0] === 'function') {
      // draw line in box
      if((startY + DATA_UNIT_HEIGHT/2) > wrapperData[0].y) {
        // draw line upwards
        drawLine(context, startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH/4, startY);
      } else {
        // draw line downwards
        drawLine(context, startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT, 
          startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2);
      }
      // draw line up to fn height
      const arrowContext = arrowLayer.scene.context;
      if (startX + DATA_UNIT_WIDTH/4 <= wrapperData[0].x + 4 * FNOBJECT_RADIUS) {
        drawLine(arrowContext, startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH/4, wrapperData[0].y + 2 * FNOBJECT_RADIUS);
        drawLine(arrowContext, startX + DATA_UNIT_WIDTH/4, wrapperData[0].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y + 2 * FNOBJECT_RADIUS);
        drawLine(arrowContext, wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y);
        drawArrow(arrowContext, wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y, 
          wrapperData[0].x + 2 * FNOBJECT_RADIUS, wrapperData[0].y);
        // duplicate arrow in hoveredLayer
        var hoverContext = hoveredLayer.scene.context;
        hoverContext.strokeStyle = 'white';
        drawLine(hoverContext, startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH/4, wrapperData[0].y + 2 * FNOBJECT_RADIUS);
        drawLine(hoverContext, startX + DATA_UNIT_WIDTH/4, wrapperData[0].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y + 2 * FNOBJECT_RADIUS);
        drawLine(hoverContext, wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y);
        drawArrow(hoverContext, wrapperData[0].x + 4 * FNOBJECT_RADIUS, wrapperData[0].y, 
          wrapperData[0].x + 2 * FNOBJECT_RADIUS, wrapperData[0].y);
      } else {
        drawLine(arrowContext, startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH/4, wrapperData[0].y);
      // draw arrow left/right to fn area
        drawArrow(arrowContext, startX + DATA_UNIT_WIDTH/4, wrapperData[0].y, 
          wrapperData[0].x + 2 * FNOBJECT_RADIUS, wrapperData[0].y);
        // duplicate arrow in hoveredLayer
        var hoverContext = hoveredLayer.scene.context;
        hoverContext.strokeStyle = 'white';
        drawLine(hoverContext, startX + DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH/4, wrapperData[0].y);
        // draw arrow left/right to fn area
        drawArrow(hoverContext, startX + DATA_UNIT_WIDTH/4, wrapperData[0].y, 
          wrapperData[0].x + 2 *FNOBJECT_RADIUS, wrapperData[0].y);
      }
    } else {
      context.fillText(dataObject[0], startX + DATA_UNIT_WIDTH/6, startY + 2 * DATA_UNIT_HEIGHT/3);
    }

    // repeat the same provess for the tail of the pair
    if (Array.isArray(dataObject[1])) {
      const result = drawThis(dataObject[1]);
      const draw = result.draw;
      if (draw) {
        drawScenePairs(dataObject[1], scene, wrapper, wrapperData[1], startX + DATA_UNIT_WIDTH + PAIR_SPACING, startY);
        drawLine(context, startX + 3 * DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH + PAIR_SPACING, startY + DATA_UNIT_HEIGHT/2);
        context.moveTo(startX + DATA_UNIT_WIDTH + PAIR_SPACING, startY + DATA_UNIT_HEIGHT/2);
        drawArrowHead(context, startX + 3 * DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, 
          startX + DATA_UNIT_WIDTH + PAIR_SPACING, startY + DATA_UNIT_HEIGHT/2);
        context.stroke();
      } else {
        // declare new context so arrow drawn in the arrowLayer instead of dataObjectLayer
        const arrowContext = arrowLayer.scene.context;
        const coordinates = getShiftInfo(result.mainStructure, result.subStructure);
        const xCoord = coordinates.x - DATA_UNIT_WIDTH/4;
        const yCoord = coordinates.y + DATA_UNIT_HEIGHT/2;
        // draw line from center of box to edge of box in dataObjectLayer
        const boxEdgeCoord = inBoxCoordinates(startX + 3 * DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, xCoord, yCoord, false);
        drawLine(context, startX + 3 * DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2, boxEdgeCoord.x, boxEdgeCoord.y);
        // draw remaining line in arrowLayer
        drawArrow(arrowContext, startX + 3 * DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2,
          xCoord, yCoord);
        // duplicate exact same line in the hoverlayer
        var hoverContext = hoveredLayer.scene.context;
        hoverContext.strokeStyle = 'white';
        drawArrow(hoverContext, startX + 3 * DATA_UNIT_WIDTH/4, startY + DATA_UNIT_HEIGHT/2,
          xCoord, yCoord);
      }
    } else if (dataObject[1] == null) {
      drawLine(context, startX + DATA_UNIT_WIDTH, startY, startX + DATA_UNIT_WIDTH/2, startY + DATA_UNIT_HEIGHT);
    } else if (typeof wrapperData[1] === 'function') {
      // draw line in box
      if((startY + DATA_UNIT_HEIGHT/2) > wrapperData[1].y) {
        // draw line upwards
        drawLine(context, startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT/2, 
          startX + 3/4 * DATA_UNIT_WIDTH, startY);
      } else {
        // draw line downwards
        drawLine(context, startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT, 
          startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT/2);
      }
      // draw arrow layer
      const arrowContext = arrowLayer.scene.context;
      if (startX + 3/4 * DATA_UNIT_WIDTH <= wrapperData[1].x + 4 * FNOBJECT_RADIUS) {
        drawLine(arrowContext, startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT/2, 
          startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y + 2 * FNOBJECT_RADIUS);
        drawLine(arrowContext, startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y + 2 * FNOBJECT_RADIUS);
        drawLine(arrowContext, wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y);
        drawArrow(arrowContext, wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y, 
          wrapperData[1].x + 2 * FNOBJECT_RADIUS, wrapperData[1].y);
        // duplicate arrow in hoveredLayer
        var hoverContext = hoveredLayer.scene.context;
        hoverContext.strokeStyle = 'white';
        drawLine(hoverContext, startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT/2, 
          startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y + 2 * FNOBJECT_RADIUS);
        drawLine(hoverContext, startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y + 2 * FNOBJECT_RADIUS);
        drawLine(hoverContext, wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y + 2 * FNOBJECT_RADIUS, 
          wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y);
        drawArrow(hoverContext, wrapperData[1].x + 4 * FNOBJECT_RADIUS, wrapperData[1].y, 
          wrapperData[1].x + 2 * FNOBJECT_RADIUS, wrapperData[1].y);
      } else {
        drawLine(arrowContext, startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT/2, 
          startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y);
      // draw arrow left/right to fn area
        drawArrow(arrowContext, startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y, 
          wrapperData[1].x + 2 * FNOBJECT_RADIUS, wrapperData[1].y);
        // duplicate arrow in hoveredLayer
        var hoverContext = hoveredLayer.scene.context;
        hoverContext.strokeStyle = 'white';
        drawLine(hoverContext, startX + 3/4 * DATA_UNIT_WIDTH, startY + DATA_UNIT_HEIGHT/2, 
          startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y);
        // draw arrow left/right to fn area
        drawArrow(hoverContext, startX + 3/4 * DATA_UNIT_WIDTH, wrapperData[1].y, 
          wrapperData[1].x + 2 * FNOBJECT_RADIUS, wrapperData[1].y);
      }
    } else {
      context.fillText(dataObject[1], startX + 2 * DATA_UNIT_WIDTH/3, startY + 2 * DATA_UNIT_HEIGHT/3);
    }
      context.strokeStyle = '#999999';
      context.lineWidth = 2;
      context.stroke();
  }

  function drawHitPairs(dataObject, hit, wrapper, x0, y0) {
    // simplified version of drawScenePairs so that we can detect when hover over pair
    var context = hit.context;
    context.beginPath();
    context.rect(x0, y0, DATA_UNIT_WIDTH, DATA_UNIT_HEIGHT);
    context.fillStyle = hit.getColorFromIndex(wrapper.key);
    context.save();
    context.fill();
    context.restore();

    if (Array.isArray(dataObject[0])) {
      drawHitPairs(dataObject[0], hit, wrapper, x0, y0 + DATA_UNIT_HEIGHT + PAIR_SPACING);
    }

    if (Array.isArray(dataObject[1])) {
      drawHitPairs(dataObject[1], hit, wrapper, x0 + DATA_UNIT_WIDTH + PAIR_SPACING, y0);
    }
    context.stroke();
  }

  function drawArrayObject(dataObject) {
    const wrapper = dataObjectWrappers[dataObjects.indexOf(dataObject)];

    drawNestedArrayObject(wrapper.x - DATA_OBJECT_SIDE, wrapper.y - DATA_UNIT_HEIGHT/2);
  }

  function drawNestedArrayObject(xcoord, ycoord) {
    var scene = dataObjectLayer.scene,
      context = scene.context;
    // define points for drawing data object 
    const x0 = xcoord,
      y0 = ycoord;
    const x1 = x0 + DATA_UNIT_WIDTH,
      y1 = y0;
    const x2 = x1,
      y2 = y1 + DATA_UNIT_HEIGHT;
    const x3 = x0,
      y3 = y2;

    // Internal Lines
    const ly0 = y0;
    const ly1 = y2;
    const l1x = x0 + 15,
     l2x = l1x + 15,
     l3x = l2x + 15;

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineTo(x3, y3);
    context.lineTo(x0, y0);
    context.moveTo(l1x, ly0);
    context.lineTo(l1x, ly1);
    context.moveTo(l2x, ly0);
    context.lineTo(l2x, ly1);
    context.moveTo(l3x, ly0);
    context.lineTo(l3x, ly1);

    context.fillStyle = '#999999';
    context.font = '14px Roboto Mono Light, Courier New';
    context.fillText('...', x0 + 50, y0 + DATA_UNIT_HEIGHT/2);
    context.strokeStyle = '#999999';
    context.lineWidth = 2;
    context.stroke();
  }

  function drawSceneDataObject(dataObject) {
    const wrapper = dataObjectWrappers[dataObjects.indexOf(dataObject)];
    var scene = dataObjectLayer.scene;
    // define points for drawing data object
    const x0 = wrapper.x - DATA_OBJECT_SIDE,
      y0 = wrapper.y - DATA_OBJECT_SIDE / 2;
    
    initialisePairShift(dataObject);
    drawScenePairs(dataObject, scene, wrapper, wrapper.data, x0, y0);
  }

  function drawHitDataObject(dataObject) {
    const wrapper = dataObjectWrappers[dataObjects.indexOf(dataObject)];
    var config = dataObject;
    var hit = dataObjectLayer.hit,
      context = hit.context;
    
    const x0 = wrapper.x - DATA_OBJECT_SIDE,
      y0 = wrapper.y - DATA_OBJECT_SIDE / 2;
    initialisePairShift(dataObject);
    drawHitPairs(dataObject, hit, wrapper, x0, y0);
  }

  function drawSceneFrame(frame) {
    var config = frame;
    var scene = config.layer.scene,
      context = scene.context;
    context.save();
    context.font = frameFontSetting;
    context.fillStyle = 'white';
    var x, y;
    x = config.x;
    y = config.y;
    context.beginPath();

    // render frame name; rename as needed for aesthetic reasons
    let frameName;
    switch (config.name) {
      case 'forLoopEnvironment':
        frameName = 'Body of for-loop';
        break;
      case 'forBlockEnvironment':
        frameName = 'Control variable of for-loop';
        break;
      case 'blockEnvironment':
        frameName = 'Block';
        break;
      case 'global':
        frameName = "Global";
        break;
      default:
        frameName = config.name;
    }
    
    if (frameName.length * 9 < config.width / 2 || frameName == 'global') {
      context.fillText(frameName, x, y - 10);
    } else {
      context.fillText(frameName, x - (frameName.length * 9 - config.width / 2), y - 10);
    }

    // render text in frame
    let elements = config.elements;
    let i = 0;
    let textX = x + HORIZONTAL_TEXT_MARGIN
    let textY = y + VERITCAL_TEXT_MARGIN

    for (let k in elements) {
      if (elements[k] == null && typeof (elements[k]) == "object") {
        // null primitive in Source
        context.fillText(`${'' + k}: null`, textX, textY + i * FRAME_HEIGHT_LINE);
      } else {
        switch (typeof elements[k]) {
          case 'number':
          case 'boolean':
          case 'undefined':
            context.fillText(`${'' + k}: ${'' + elements[k]}`, textX, textY + i * FRAME_HEIGHT_LINE);
            break;
          case 'string':
            if (k == '(other predclr. names)') {
              context.fillText(`${'' + k}`, textX, textY + i * FRAME_HEIGHT_LINE);
            } else {
              context.fillText(`${'' + k}: "${'' + elements[k]}"`, textX, textY + i * FRAME_HEIGHT_LINE);
            }
            break;
          default:
            context.fillText(`${'' + k}:`, textX, textY + i * FRAME_HEIGHT_LINE);
            i += getUnitHeight(elements[k]);
        }
      }
      i++;
    }

    context.rect(x, y, config.width, config.height);
    context.lineWidth = 2;
    context.strokeStyle = 'white';
    context.stroke();

    if (config.selected) {
      context.strokeStyle = 'white';
      context.lineWidth = 6;
      context.stroke();
    }

    if (config.hovered) {
      context.strokeStyle = 'green';
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function drawHitFrame(config) {
    if (config.variables.length == 0) {
      return;
    }
    var hit = config.layer.hit,
      context = hit.context;

    var x, y;
    if (config.tail != null) {
      x = frames[config.tail].x;
      y = frames[config.tail].y + 200;
      config.x = x;
      config.y = y;
    } else {
      x = config.x;
      y = config.y;
    }

    context.beginPath();
    context.rect(x, y, 150, 100);
    context.fillStyle = hit.getColorFromIndex(config.key);
    context.save();
    context.fill();
    context.restore();
  }

  /**
   * Trivial - the arrow just points straight to a fixed position relative to
   * the frame.
   */
  function drawSceneFrameDataArrow(frame, name, dataObject) {
    const wrapper = dataObjectWrappers[dataObjects.indexOf(dataObject)];
    var scene = arrowLayer.scene,
      context = scene.context;
    
    
    context.strokeStyle = '#999999';
  
    // simply draw straight arrow from frame to function
    const x0 = frame.x + name.length * FRAME_WIDTH_CHAR + 25;
    const y0 = frame.y + findElementNamePosition(name, frame) * FRAME_HEIGHT_LINE + 35,
      xf = wrapper.x - FNOBJECT_RADIUS * 2 - 3; //adjustment
      const yf = wrapper.y;
    
    drawArrow(context, x0, y0, xf, yf);
    // duplicate the exact same arrow but in the hovered layer so it only
    // comes into view once you hover over it
    var hoverContext = hoveredLayer.scene.context;
    hoverContext.strokeStyle = 'white';
    drawArrow(hoverContext, x0, y0, xf, yf);
    
      /**
       * dataObject belongs to different frame.
       * Two "offset" factors are used: frameOffset, the index position of
       * the source variable in the starting frame, and fnOffset, the position
       * of the target dataObject in the destination frame. Offsetting the line
       * by these factors prevents overlaps between arrows that are pointing to
       * different objects.
       
      const frameOffset = findElementPosition(dataObject, frame);
      const fnOffset = findElementPosition(dataObject, wrapper.parent);
      const x0 = frame.x + name.length * 8 + 22;
      const yf = wrapper.y;
      const y0 = frame.y + findElementNamePosition(name, frame) * FRAME_HEIGHT_LINE + 35;
      const xf = wrapper.x;
      /*
        x1 = frame.x + frame.width + 10 + frameOffset * 20,
        y1 = y0;
      const x2 = x1,
        y2 = frame.y - 20 + frameOffset * 5;
      let x3 = xf + 10 + fnOffset * 7,
        y3 = y2;
      /**
       * From this position, the arrow needs to move upward to reach the
       * target dataObject. Make sure it does not intersect any other object
       * when doing so, or adjust its position if it does.
       * This currently only works for the frame level directly above the origin
       * frame, which suffices in most cases.
       * TO-DO: Improve implementation to handle any number of frame levels.
      */
      /*
      levels[frame.level - 1].frames.forEach(function(frame) {
        const leftBound = frame.x;
        let rightBound = frame.x + frame.width;
        // if (frame.fnObjects.length != 0) {
          // rightBound += 84;
        // }
        if (x3 > leftBound && x3 < rightBound) {
          // overlap
          x3 = rightBound + 10 + fnOffset * 7;
        }
      });
      const x4 = x3,
        y4 = yf;
      
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.lineTo(x2, y2);
      context.lineTo(x3, y3);
      context.lineTo(x4, y4);
      context.lineTo(xf, yf);
      // draw arrow headClone
      drawArrowHead(context, x4, y4, xf, yf);
      context.stroke();
      
      drawLine(context, x0, y0, xf, y0);
      drawArrow(context, xf, y0, xf, yf);
      // duplicate the exact same arrow but in the hovered layer so it only
      // comes into view once you hover over it
      */
    
  }

  /**
   * For each function variable, either the function is defined in the scope
   * the same frame, in which case drawing the arrow is simple, or it is in
   * a different frame. If so, more care is needed to route the arrow back up
   * to its destination.
   */
  function drawSceneFrameFnArrow(frame, name, fnObject) {
    var scene = arrowLayer.scene,
      context = scene.context;
    const yf = fnObject.y;
    context.save();
    context.strokeStyle = '#999999';
    context.beginPath();

    if (fnObject.parent == frame) {
      // fnObject belongs to current frame
      // simply draw straight arrow from frame to function
      const x0 = frame.x + name.length * FRAME_WIDTH_CHAR + 25;
      const y0 = frame.y + findElementNamePosition(name, frame) * FRAME_HEIGHT_LINE + 35,
        xf = fnObject.x - FNOBJECT_RADIUS * 2 - 3; // left circle
      context.moveTo(x0, y0);
      context.lineTo(xf, yf);

      // draw arrow head
      drawArrowHead(context, x0, y0, xf, yf);
      context.stroke();
    } else {
      /**
       * fnObject belongs to different frame.
       * Three "offset" factors are used: startOffset, the index position of
       * the source variable in the starting frame; fnOffset, the position
       * of the target fnObject in the destination frame; and frameOffset, the
       * position of the frame within its level. Offsetting the line
       * by these factors prevents overlaps between arrows that are pointing to
       * different objects.
       */
      const startOffset = findElementPosition(fnObject, frame);
      const fnOffset = findElementPosition(fnObject, fnObject.parent);
      const frameOffset = findFrameIndexInLevel(frame);
      const x0 = frame.x + name.length * 8 + 22,
        y0 = frame.y + findElementNamePosition(name, frame) * FRAME_HEIGHT_LINE + 35;
      const xf = fnObject.x + FNOBJECT_RADIUS * 2 + 3,
        x1 = frame.x + frame.width + 10 + frameOffset * 20,
        y1 = y0;
      const x2 = x1,
        y2 = frame.y - 20 + frameOffset * 5;
      let x3 = xf + 12 + fnOffset * 7,
        y3 = y2;
      /**
       * From this position, the arrow needs to move upward to reach the
       * target fnObject. Make sure it does not intersect any other object
       * when doing so, or adjust its position if it does.
       * This currently only works for the frame level directly above the origin
       * frame, which suffices in most cases.
       * TO-DO: Improve implementation to handle any number of frame levels.
       */

      levels[frame.level - 1].frames.forEach(function(frame) {
        const leftBound = frame.x;
        let rightBound = frame.x + frame.width;
        // if (frame.fnObjects.length != 0) {
          // rightBound += 84;
        // }
        if (x3 > leftBound && x3 < rightBound) {
          // overlap
          x3 = rightBound + 10 + fnOffset * 7;
        }
      });
      const x4 = x3,
        y4 = yf;
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.lineTo(x2, y2);
      context.lineTo(x3, y3);
      context.lineTo(x4, y4);
      context.lineTo(xf, yf);
      // draw arrow headClone
      drawArrowHead(context, x4, y4, xf, yf);
      context.stroke();
    }
  }

  function drawSceneFnFrameArrow(fnObject) {
    var scene = arrowLayer.scene,
      context = scene.context;
    //const offset = frames[pair[0]].fnIndex.indexOf(pair[1]);

    var startCoord = [fnObject.x + PAIR_SPACING, fnObject.y];

    //scene.clear();
    context.save();
    context.strokeStyle = '#999999';
    context.beginPath();
    
    //  Previous condition:
    // fnObject.source == null || fnObject.source == fnObject.parent
    // By right, the arrow should always point left to the frame directly adjacent
    // There is no other way for the arrow to point.
    // Currently, if fnObject is defined in an array, do not draw the arrow (remove after arrays are implemented)
    if (!(Array.isArray(fnObject.parent) && fnObject.parent[0].length != 2)) {
      frame = fnObject.parent;
      if(fnObject.parenttype == "data"){ 
        parentobj = dataObjects.indexOf(fnObject.parent[0])
        frame = dataObjectWrappers[parentobj].parent
      } 

      const x0 = fnObject.x + FNOBJECT_RADIUS,
        y0 = startCoord[1],
        x1 = x0,
        y1 = y0 - 15,
        x2 = frame.x + frame.width + 3,
        y2 = y1;
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.lineTo(x2, y2);
      // draw arrow headClone
      drawArrowHead(context, x1, y1, x2, y2);
      context.stroke();
    } else {
      // Kept here just in case
      /**
       * startOffset: index of fnObject in its parent (starting) frame
       * destOffset: index of fnObject in source (destination) frame
       * frameOffset: index of source frame within its level
       */
      // const startOffset = findElementPosition(fnObject, fnObject.parent);
      // const destOffset = findElementPosition(fnObject, fnObject.source);
      // const frameOffset = findFrameIndexInLevel(fnObject.source);
      // const x0 = startCoord[0],
      //   y0 = startCoord[1],
      //   x1 = x0 + FNOBJECT_RADIUS + (startOffset + 1) * 5;
      //   y1 = y0,
      //   x2 = x1,
      //   y2 = fnObject.source.y - 40 + frameOffset * 2,
      //   x3 = fnObject.source.x + fnObject.source.width / 2 + 10,
      //   y3 = y2
      //   x4 = x3,
      //   y4 = fnObject.source.y - 3;
      // context.moveTo(x0, y0);
      // context.lineTo(x1, y1);
      // context.lineTo(x2, y2);
      // context.lineTo(x3, y3);
      // context.lineTo(x4, y4);
      // drawArrowHead(context, x3, y3, x4, y4);
      // context.stroke();
    }
  }

  /**
   * Arrows between child and parent frames.
   * Uses an offset factor to prevent lines overlapping, similar to with
   * frame-function arrows.
   */
  function drawSceneFrameArrow(frame) {
    var config = frame;
    var scene = arrowLayer.scene,
      context = scene.context;
    context.save();
    context.strokeStyle = 'white';
    
    if (config.parent == null) return null;
    const parent = config.parent;
    const offset = levels[parent.level].frames.indexOf(frame.parent);
    const x0 = config.x + 40,
      y0 = config.y,
      x1 = x0,
      y1 = (parent.y + parent.height + y0) / 2 + offset * 4,
      x2 = parent.x + 40;
    (y2 = y1), (x3 = x2), (y3 = parent.y + parent.height + 3); // offset by 3 for aesthetic reasons
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineTo(x3, y3);
    drawArrowHead(context, x2, y2, x3, y3);
    context.stroke();
  }

  /**
   * Create a different layer for each type of element. May be more useful
   * in future for manipulating groups of elements.
   */
  var fnObjectLayer = new Concrete.Layer();
  var dataObjectLayer = new Concrete.Layer();
  var frameLayer = new Concrete.Layer();
  var arrowLayer = new Concrete.Layer();
  var hoveredLayer = new Concrete.Layer();
  hoveredLayer.visible = false;

  fnObjects = [];
  /**
   * Unlike function objects, data objects are represented internally not as
   * objects, but as arrays. As such, we cannot assign properties like x- and
   * y-coordinates directly to them. These properties are stored instead in
   * another array of objects called dataObjectWrappers, which maps 1-to-1 to
   * the objects they represent in dataObjects.
   */
  dataObjects = [];
  dataObjectWrappers = [];
  levels = {};
  builtinsToDraw = [];
  envKeyCounter = 0;
  
  let drawnDataObjects = [];
  var frames = [];
  
  /**
   * Assigns an x- and a y-coordinate to every frame and object.
   */
  function positionItems(frames) {
    /**
     * Find and store the height of each level
     * (i.e. the height of the tallest environment)
     */
    for (let l in levels) {
      const level = levels[l];
      let maxHeight = 0;
      let fullwidthArray = [];
      level.frames.forEach(function(frame) {
        if (frame.height > maxHeight) {
          maxHeight = frame.height;
        }
        fullwidthArray.push(frame.fullwidth)
      });
      level.height = maxHeight;
      level.widthArray = fullwidthArray
    }

    /**
     * Calculate x- and y-coordinates for each frame
     */ 
    const drawingWidth = getDrawingWidth(levels) + 2 * DRAWING_LEFT_PADDING;
    frames.forEach(function(frame) {
      let currLevel = frame.level;

      /**
       * y-coordinate
       * Simply the total height of all levels above the frame, plus a
       * fixed spacing factor (60) per level.
       */
      let y = 30;
      for (let i = 0; i < currLevel; i++) {
        y += levels[i].height + LEVEL_SPACING;
      }
      frame.y = y;
      
    });
        
     /**
     * x-coordinate
     * All frames are left-aligned. Iterate through each level, assigning the x-coordinate
     * depending on how much space the frames on the left are taking up
     * Potential future improvement: Group frames together in a tree structure, and assign space recurisvely 
     * to each frame. However, need to fix max drawing size, which is currently limited.
     */
    for (let l in levels) {
      const level = levels[l];
      const frameWidthArray = level.widthArray
      level.frames.forEach(function(frame) {
        const frameIndex = level.frames.indexOf(frame)
        if(frameIndex > 0) {
          frame.x = DRAWING_LEFT_PADDING
          for(let i = 0; i < frameIndex; i++) {
            frame.x += frameWidthArray[i] + 20;
          }
        } else {
          frame.x = DRAWING_LEFT_PADDING;
        }
      });
    }

    /**
     * Calculate coordinates for each fnObject and dataObject.
     */    
    for (d in dataObjects) {
      const wrapper = dataObjectWrappers[d];
      const parent = wrapper.parent;
      wrapper.x = parent.x 
                  + parent.width 
                  + OBJECT_FRAME_RIGHT_SPACING;
      wrapper.y = parent.y
                  + findElementPosition(dataObjects[d], parent) * FRAME_HEIGHT_LINE
                  + OBJECT_FRAME_TOP_SPACING;
    }

    fnObjects.forEach(function (fnObject) {
      // Checks the parent of the function, calculating coordinates accordingly
      let parent = fnObject.parent;
      if(Array.isArray(parent)){
        // Check if parent has x and y coordinates
        // Otherwise use getShiftInfo to calculate
        if(parent[0] === parent[1]){
          parentWrapper = getWrapperFromDataObject(parent[1])
          fnObject.x = parentWrapper.x 
          fnObject.y = parentWrapper.y + FRAME_HEIGHT_LINE
          if(parent.length > 1 && parent[1][1] == fnObject){
            fnObject.x += DATA_UNIT_WIDTH / 2
          }
        } else {
          parent_coordinates = getShiftInfo(parent[0], parent[1])
          fnObject.x = parent_coordinates.x
          fnObject.y = parent_coordinates.y + FRAME_HEIGHT_LINE - 18
          if(parent.length > 1 && parent[1][1] == fnObject){
            fnObject.x += DATA_UNIT_WIDTH / 2
          }
        }
      } else {
        fnObject.x = parent.x 
                   + parent.width 
                   + OBJECT_FRAME_RIGHT_SPACING;
        fnObject.y = parent.y +
                    findElementPosition(fnObject, parent) * FRAME_HEIGHT_LINE
                   + OBJECT_FRAME_TOP_SPACING;
      }
    });

  }

  function drawArrowHead(context, xi, yi, xf, yf) {
    const gradient = (yf - yi) / (xf - xi);
    const angle = Math.atan(gradient);
    if (xf - xi >= 0) {
      // left to right arrow
      const xR = xf - 10 * Math.cos(angle - Math.PI / 6);
      const yR = yf - 10 * Math.sin(angle - Math.PI / 6);
      context.lineTo(xR, yR);
      context.moveTo(xf, yf);
      const xL = xf - 10 * Math.cos(angle + Math.PI / 6);
      const yL = yf - 10 * Math.sin(angle + Math.PI / 6);
      context.lineTo(xL, yL);
    } else {
      // right to left arrow
      const xR = xf + 10 * Math.cos(angle - Math.PI / 6);
      const yR = yf + 10 * Math.sin(angle - Math.PI / 6);
      context.lineTo(xR, yR);
      context.moveTo(xf, yf);
      const xL = xf + 10 * Math.cos(angle + Math.PI / 6);
      const yL = yf + 10 * Math.sin(angle + Math.PI / 6);
      context.lineTo(xL, yL);
    }
  }

  // main function to be exported
  function draw_env(context) {
    // add built-in functions to list of builtins
    let originalEnvs = context.context.context.runtime.environments;
    let allEnvs = [];
    originalEnvs.forEach(function(e) {
      allEnvs.push(e);
    });
    builtins = builtins.concat(Object.keys(allEnvs[allEnvs.length - 1].head));
    builtins = builtins.concat(Object.keys(allEnvs[allEnvs.length - 2].head));

    // add library-specific built-in functions to list of builtins
    const externalSymbols = context.context.context.externalSymbols;
    for (let i in externalSymbols) {
      builtins.push(externalSymbols[i]);
    }

    // Hides the default text
    (document.getElementById('env-visualizer-default-text')).hidden = true;

    // Blink icon
    const icon = document.getElementById('env_visualiser-icon');
    icon.classList.add('side-content-tab-alert');

    // reset current drawing
    fnObjectLayer.scene.clear();
    dataObjectLayer.scene.clear();
    frameLayer.scene.clear();
    arrowLayer.scene.clear();
    hoveredLayer.scene.clear();
    fnObjects = [];
    dataObjects = [];
    dataObjectWrappers = [];
    levels = {};
    builtinsToDraw = [];
    
    // parse input from interpreter
    function parseInput(allFrames, envs) {
      let environments = envs;
      let frames = [];
      /**
       * environments is the array of environments in the interpreter.
       * frames is the current frames being created
       * allFrames is all frames created so far (including from previous
       * recursive calls of parseInput).
       */

      /**
       * For some reason, some environments are not present in the top level 
       * array of environments in the input context. Here, we extract those
       * missing environments.
       */
      let i = environments.length - 4; // skip global and program environments
      while (i >= 0) {
        const currEnv = allEnvs[i];
        if (!allEnvs.includes(currEnv.tail)) {
          if(environments === allEnvs) {
            allEnvs.splice(i + 1, 0, currEnv.tail);
          } else {
            allEnvs.splice(i + 1, 0, currEnv.tail);
            environments.splice(i + 1, 0, currEnv.tail);
          }
          i += 2;
        }
        i--;
      }

      // add layers
      viewport
        .add(frameLayer)
        .add(fnObjectLayer)
        .add(dataObjectLayer)
        .add(arrowLayer)
        .add(hoveredLayer);
      /**
       * Refactor start
       */
      
      // Assign the same id to each environment and its corresponding frame
      environments.forEach(function(e) {
        e.envKeyCounter = envKeyCounter;
        envKeyCounter++;
      });

      /**
       * Create a frame for each environment
       * Each frame represents one frame to be drawn
       */
      // Process backwards such that global frame comes first
      for (let i = environments.length - 1; i >= 0; i--) {
        let environment = environments[i];      
        let frame;
              
        /**
         * There are two environments named programEnvironment. We only want one
         * corresponding "Program" frame.
         */
        if (environment.name == "programEnvironment") {
          let isProgEnvPresent = false;
          frames.forEach(function (f) {
            if (f.name == "Program") {
              frame = f;
              isProgEnvPresent = true;
            }
          });
          if (!isProgEnvPresent) {
            frame = createEmptyFrame("Program");
            frame.key = environment.envKeyCounter;
            frames.push(frame);
            allFrames.push(frame);
          }
        } else {
          frame = createEmptyFrame(environment.name);
          frame.key = environment.envKeyCounter;
          frames.push(frame);
          allFrames.push(frame);
        }
        
        // extract elements from environment into frame
        frame.elements = {};
        if (frame.name == "global") {
          frame.elements['(other predclr. names)'] = '';
          // don't copy over built-in functions
        } else if (environment.name == "programEnvironment"
                    && environment.tail.name == "global") {
          // do nothing (this environment contains library functions)
        } else {
          // copy everything (possibly including redeclared built-ins) over
          const envElements = environment.head;
          for (e in envElements) {
            frame.elements[e] = envElements[e];
            if (typeof envElements[e] == "function"
                && builtins.indexOf('' + getFnName(envElements[e])) > 0
                && getFnName(envElements[e])) {
              // this is a built-in function referenced to in a later frame,
              // e.g. "const a = pair". In this case, add it to the global frame
              // to be drawn and subsequently referenced.
              frames[0].elements[getFnName(envElements[e])] = envElements[e];
            }
          }
        } 
      }

      /**
       * - Assign parent frame of each frame (except global frame)
       * - Assign level of each frame. Frames are organised into distinct 
       *   vertical bands. Global frame is at the top (level 0). Every
       *   other frame is 1 level below its parent.
       */
      frames.forEach(function(frame) {
        if (frame.name == "global") {
          frame.parent = null;
          frame.level = 0;
        } else {
          if (frame.name == "Program") {
            frame.parent = getFrameByName(allFrames, "global");
          } else {
            env = getEnvByKeyCounter(environments, frame.key);
            if (env.tail.name == "programEnvironment") {
              env = env.tail;
            }
            frame.parent = getFrameByKey(allFrames, env.tail.envKeyCounter);
          }
          // For loops do not have frame.parent, only while loops and functions do
          if(frame.parent) {
            frame.parent.children.push(frame.key);
            frame.level = frame.parent.level + 1;            
          }
        }
        
        // update total number of frames in the current level
        if (levels[frame.level]) {
          levels[frame.level].count++;
          levels[frame.level].frames.push(frame);
        } else {
          levels[frame.level] = { count: 1 };
          levels[frame.level].frames = [frame];
        }
      });
      
      /**
       * Extract function and data objects from frames. Each distinct object is
       * drawn next to the first frame where it is referenced; subsequent
       * references point back to the object.
       */      
      frames.forEach(function(frame) {
        const elements = frame.elements;
        for (e in elements) {
          if (typeof elements[e] == "function"
            && !fnObjects.includes(elements[e])) {
            initialiseFrameFnObject(elements[e], frame)
            fnObjects.push(elements[e])
          } else if (typeof elements[e] == "object"
            && !dataObjects.includes(elements[e])) {
            dataObjects.push(elements[e])
            dataObjectWrappers.push(
              initialiseDataObjectWrapper(e, elements[e], frame)
            );
            // Iterate through elements[e], check if function exists in fnObjects	
            // If no, instantiate and add to fnObjects array	
            findFnInDataObject(elements[e], elements[e], elements[e])
          }
        }
      });

      function findFnInDataObject(list, parent, dataObject){		
        if (Array.isArray(list)) {		
          findFnInDataObject(list[0], list, dataObject)		
          findFnInDataObject(list[1], list, dataObject)		
        } else if(isFunction(list) && !fnObjects.includes(list)) {		
          initialiseDataFnObject(list, [dataObject, parent])		
          fnObjects.push(list);		
        }		
      }	

      /** 
       * - Find width and height of each frame
       */

      for(let i = frames.length - 1; i >= 0; i--) {
        let frame = frames[i];
        frame.height = getFrameHeight(frame);
        frame.width = getFrameWidth(frame);
        frame.fullwidth = getFrameAndObjectWidth(frame);
      }



      /**
       * Some functions may have been generated via anonymous functions, whose
       * environments would not have been present in initial array from the
       * interpreter.
       * Find these environments, and recursively process them.
       */
      const missing = []; // think of a better name
      fnObjects.forEach(function (fnObject) {
        let otherEnv = fnObject.environment;
        /**
         * There may be multiple levels of anonymous function frames, e.g.
         * from the expression (w => x => y => z)(1)(2), where
         * w => x => ... generates one frame, and
         * x => y => ... generates another.
         * The while loop ensure all of these frames are extracted.
         */
        while (!allEnvs.includes(otherEnv)) {
          missing.push(otherEnv);
          allEnvs.push(otherEnv);
          // find function definition expression to use as frame name
          
          if(!otherEnv.callExpression) {
            // When the environment is a loop, it doesn't have a call expression
            break;
          }

          let pointer = otherEnv.callExpression.callee;
          let i = 0;
          while (pointer.callee) {
            pointer = pointer.callee;
            i++;
          }
          while (i > 0) {
            pointer = pointer.body;
            i--;
          }
          const params = pointer.params;
          let paramArray = [];
          let paramString;
          try {
            params.forEach(function(p) {
              paramArray.push(p.name);
            });
            const paramString = "(" + paramArray.join(", ") + ") => ...";
            otherEnv.vizName = paramString;
          } catch (e) {
            // for some reason or other the function definition expression is
            // not always available. In that case, just use the frame name
          }
          otherEnv = otherEnv.tail;
        };
      });
      if (missing.length > 0) {
        frames = (parseInput(allFrames, missing));
      } 

      return allFrames;
    }

    frames = parseInput([], allEnvs);
    /**
     * Find the source frame for each fnObject. The source frame is the frame
     * which generated the function. This may be different from the parent
     * frame, which is the first frame where the object is referenced.
     */
    fnObjects.forEach(function(fnObject) {
      if (fnObject.environment.name == "programEnvironment") {
        fnObject.source = getFrameByName(frames, "Program");
      } else {
        fnObject.source = getFrameByKey(frames, fnObject.environment.envKeyCounter);
      }
    });

    positionItems(frames);
    let drawingWidth = Math.max(getDrawingWidth(levels)* 1.6, 300)
    viewport.setSize(drawingWidth, getDrawingHeight(levels));
    // "* 1.6" is a partial workaround for drawing being cut off on the right
    
    drawSceneFrames();
    drawSceneFnObjects();
    drawHitFnObjects();
    drawSceneDataObjects();
    drawHitDataObjects();
    drawSceneFrameArrows();
    drawSceneFrameObjectArrows();
    drawSceneFnFrameArrows();
    // add concrete container handlers
    container.addEventListener('mousemove', function(evt) {
      var boundingRect = container.getBoundingClientRect(),
        x = evt.clientX - boundingRect.left,
        y = evt.clientY - boundingRect.top,
        key = viewport.getIntersection(x, y),
        fnObject,
        dataObject;
      // unhover all circles
      fnObjects.forEach(function(fnObject) {
        fnObject.hovered = false;
      });

      for (d in dataObjects) {
        dataObjectWrappers[d].hovered = false;
      }

      if (key >= 0) {
        hoveredLayer.visible = true; 
        viewport.render();
      }
      else {
        hoveredLayer.visible = false;
        viewport.render();
      }

      if (key >= 0 && key < Math.pow(2, 23)) {
        fnObject = getFnObjectFromKey(key);
        try {
          fnObject.hovered = true;
        } catch (e) {}
      } else if (key >= Math.pow(2, 23)) {
        dataObject = getDataObjectFromKey(key);
        try {
          getWrapperFromDataObject(dataObject).hovered = true;
        } catch (e) {}
      }
      drawSceneFnObjects();
      drawSceneDataObjects();
    });

    container.addEventListener('click', function(evt) {
      var boundingRect = container.getBoundingClientRect(),
        x = evt.clientX - boundingRect.left,
        y = evt.clientY - boundingRect.top,
        key = viewport.getIntersection(x, y),
        fnObject,
        dataObject;
      // unhover all circles
      fnObjects.forEach(function(fnObject) {
        fnObject.selected = false;
      });

      for (d in dataObjects) {
        dataObjectWrappers[d].hovered = false;
      }

      if (key >= 0 && key < Math.pow(2, 23)) {
        fnObject = getFnObjectFromKey(key);
        try {
          fnObject.selected = true;
        } catch (e) {}
      } else if (key > Math.pow(2, 23)) {
        dataObject = getDataObjectFromKey(key);
        try {
          getWrapperFromDataObject(dataObject).selected = true;
          draw_data(dataObject.data);
        } catch (e) {}
      }

      drawSceneFnObjects();
      drawSceneDataObjects();
    });
    frames.reverse();
    // reorder layers
    arrowLayer.moveToBottom();
    fnObjectLayer.moveToTop();
    dataObjectLayer.moveToTop();
    hoveredLayer.moveToTop();
    viewport.render();
  }
  exports.draw_env = draw_env;

  function getFnObjectFromKey(key) {
    for (f in fnObjects) {
      if (fnObjects[f].key === key) {
        return fnObjects[f];
      }
    }
  }

  function getDataObjectFromKey(key) {
    for (d in dataObjects) {
      if (dataObjects[d].key === key) {
        return dataObjects[d];
      }
    }
  }

  function getFnName(fn) {
    if (fn.node.type == "FunctionDeclaration" && !fn.functionName) {
      return undefined;
    } else if (fn.node.type == "FunctionDeclaration") {
      return fn.functionName;
    } else {
      return fn
        .toString()
        .split('(')[0]
        .split(' ')[1];
    }
  }

  function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }
  
  function isArrowFunction(fn) {
    return fn.node.type == "ArrowFunctionExpression";
  }

  function createEmptyFrame(frameName) {
    const frame = {name: frameName};
    frame.hovered = false;
    frame.layer = frameLayer;
    frame.color = white;
    frame.children = [];
    return frame;
  }
  
  function getFrameByKey(frames, key) {
    for (let i in frames) {
      if (frames[i].key == key) {
        return frames[i];
      }
    }
    return null;
  }
  
  function getEnvByKeyCounter(frames, key) {
    for (let i in frames) {
      if (frames[i].envKeyCounter == key) {
        return frames[i];
      }
    }
    return null;
  }
  
  function getFrameByName(frames, name) {
    for (let i in frames) {
      if (frames[i].name == name) {
        return frames[i];
      }
    }
    return null;
  }

  function isFunction(functionToCheck) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
  }

  // Needs to be updated. However is_pair does not work as expected
  function is_Array(dataObject) {
    // return !is_pair(dataObject) && Array.isArray(dataObject);
    return dataObject.length != 2
  }

  // Space Calculation Functions
  
  // Calculates width of a list/array
  function getListWidth(list) {
    let otherObjects = [];
    let objectStored = false;
    dataObjects.forEach(x => {
      if(x == list){
        objectStored = true;
      }
      if(objectStored){
      } else if(x !== list) {
        otherObjects.push(x)
      }
    })

    function getUnitWidth(list){
      let substructureExists = false;
      otherObjects.forEach(x => {
        if(checkSubStructure(x, list)){
          substructureExists = true;
        }
      })

      if (!Array.isArray(list) || substructureExists) {
        return 0;
      } else {
        return Math.max(getUnitWidth(list[1]) + 1, getUnitWidth(list[0]))
      }
    }

    if(list.length != 2) {
      // If list is array, check that it is not a substructure of any other data structure
      let substructureExists = false;
      otherObjects.forEach(x => {
        if(checkSubStructure(x, list)){
          substructureExists = true;
        }
      })

      if(substructureExists){
        return 0;
      } else {
        return DATA_UNIT_WIDTH;
      }
    } else {
      let pairCount = getUnitWidth(list);
      return pairCount * (DATA_UNIT_WIDTH + 15);
    }
  }

// Calculates unit height of list/array, considering references to other data structures
  function getUnitHeight(parentlist) {
    /**
     * otherObjects contains all data objects initialised before parentlist
     * This is to check if any part of parentlist is a substructure of any
     * previously defined data structure, and omit that part from the height calculations
     */
    let otherObjects = [];
    let objectStored = false;
    dataObjects.forEach(x => {
      if(x == parentlist){
        objectStored = true;
      } else if(!objectStored) {
        otherObjects.push(x)
      }    
    })

    function recursiveHelper(list){
      // Check if list is simply a substructure of any previously defined data structure
      let substructureExists = false;
      otherObjects.forEach(x => {
        if(checkSubStructure(x, list)){
          substructureExists = true;
        }
      })
      if (!Array.isArray(list) || substructureExists) {
        if (isFunction(list)) {
          let fnObject = fnObjects[fnObjects.indexOf(list)];
          let parenttype = fnObject.parenttype;
          if (parenttype == "data" && fnObject.parent[0] == parentlist) {
            return 1;
          }
        }
        return 0;
      } else if (Array.isArray(list[0])) {
        let substructureExistsHead = false;
        otherObjects.forEach(x => {
          if(checkSubStructure(x, list[0])){
            substructureExistsHead = true;
          }
        })
        if(substructureExistsHead){
          return recursiveHelper(list[1]);
        } else {
          return 1 + recursiveHelper(list[0]) + recursiveHelper(list[1]);
        }     
      } else if (isFunction(list[0])) {
        let fnObject = fnObjects[fnObjects.indexOf(list[0])]
        let parenttype = fnObject.parenttype;
        let tail_height = recursiveHelper(list[1])
        if(parenttype == "frame" || tail_height > 0) {
          return tail_height;
        } else if(fnObject.parent[0] == parentlist) {
          return 1;
        } else {
          return 0;
        }
      } else {
        return recursiveHelper(list[1]);
      }
    }

    if(parentlist.length != 2) {
      return 0;
    } else {
      return recursiveHelper(parentlist)
    }
  }

  // Calculates unit height of a list, ignoring references to other data structures
  function getBasicUnitHeight(list){
    if (!Array.isArray(list)) {
      return 0;
    } else if (Array.isArray(list[0])) {
      return 1 + getBasicUnitHeight(list[0]) + getBasicUnitHeight(list[1]);
    } else if (isFunction(list[0])) {
      let parenttype = fnObjects[fnObjects.indexOf(list[0])].parenttype;
      let tail_height = getBasicUnitHeight(list[1])
      if(parenttype == "frame" || tail_height > 0) {
        return tail_height;
      } else {
        return 1;
      }
    } else {
      return getBasicUnitHeight(list[1]);
    }
  }

// Initialise parent data structure before using calculatePairShift
  let currentObject = null;
  function initialisePairShift(dataObject) {
    currentObject = dataObject;
  }

// Determines the height positioning of pairs in the same data structure 
  function calculatePairShift(sublist){
    let otherObjects = [];
    let objectStored = false;
    dataObjects.forEach(x => {
      if(x == currentObject){
        objectStored = true;
      }
      if(objectStored){
      } else if(x !== currentObject) {
        otherObjects.push(x)
      }
    })
    function recursiveHelper(list){
      let substructureExists = false;
      otherObjects.forEach(x => {
        if(checkSubStructure(x, list)){
          substructureExists = true;
        }
      })
      if (!Array.isArray(list) || substructureExists) {
        if (isFunction(list)) {
          let fnObject = fnObjects[fnObjects.indexOf(list)];
          let parenttype = fnObject.parenttype;
          if (parenttype == "data" && fnObject.parent[0] == currentObject) {
            return 1;
          }
        }
        return 0;
      } else if (Array.isArray(list[0])) {
        let substructureExistsHead = false;
        otherObjects.forEach(x => {
          if(checkSubStructure(x, list[0])){
            substructureExistsHead = true;
          }
        })
        if(substructureExistsHead){
          return recursiveHelper(list[1]);
        } else {
          return 1 + recursiveHelper(list[0]) + recursiveHelper(list[1]);
        }  
      } else if (isFunction(list[0])) {
        let fnObject = fnObjects[fnObjects.indexOf(list[0])]
        let parenttype = fnObject.parenttype;
        let tail_height = recursiveHelper(list[1])
        if(parenttype == "frame" || tail_height > 0) {
          return tail_height;
        } else if(fnObject.parent[0] == currentObject) {
          return 1;
        } else {
          return 0;
        }
      } else {
        return recursiveHelper(list[1]);
      }
    }
    return (recursiveHelper(sublist) + 1) * (DATA_UNIT_HEIGHT + PAIR_SPACING);
  }

  // Calculates list/array height 
  // Used in frame height calculations
  function getListHeight(list) {
    let x = (getUnitHeight(list) + 1) * (DATA_UNIT_HEIGHT + PAIR_SPACING);
    return x;
  }

  function getFrameHeight(frame) {
    // Assumes line spacing is separate from data object spacing
    let elem_lines = 0;
    let data_space = 0;

    for(elem in frame.elements){
      if(isFunction(frame.elements[elem])) {
        elem_lines += 1;
      } 
      else if(Array.isArray(frame.elements[elem])) {
        const parent = dataObjectWrappers[dataObjects.indexOf(frame.elements[elem])].parent;
        if(parent == frame) {
          data_space += getListHeight(frame.elements[elem]);
        } else {
          data_space += FRAME_HEIGHT_LINE;
        }        
      } 
      else {
        elem_lines += 1;
      }
    }
    
    return data_space + elem_lines * FRAME_HEIGHT_LINE + FRAME_HEIGHT_PADDING;
  }
  
  // Calculates width of frame only
  function getFrameWidth(frame) {
    let maxLength = 0;
    const elements = frame.elements;
    for (e in elements) {
      if(true) {
        let currLength;
        const literals = ["number", "string", "boolean"];
        if (literals.includes(typeof elements[e])) {
          currLength = e.length + elements[e].toString().length;
        } else if (typeof elements[e] == "undefined") {
          currLength = e.length + 9;
        } else {
          currLength = e.length;
        }
        maxLength = Math.max(maxLength, currLength);
      } 
    }
    return maxLength * FRAME_WIDTH_CHAR + FRAME_WIDTH_PADDING;    
  }

  // Calculates width of objects + frame
  function getFrameAndObjectWidth(frame){
    if(frame.elements.length == 0){
      return getFrameWidth(frame);
    } else {
      let maxWidth = 0;
      for(e in frame.elements) {

        // Can be either primitive, function or array
        if(isFunction(frame.elements[e])) {
          if(frame.elements[e].parent == frame) {
            maxWidth = Math.max(maxWidth, DATA_UNIT_WIDTH);
          }          
        } else if(Array.isArray(frame.elements[e])) {
          const parent = dataObjectWrappers[dataObjects.indexOf(frame.elements[e])].parent;
          if(parent == frame) {
            maxWidth = Math.max(maxWidth, getListWidth(frame.elements[e]))
          }
        } 
      }
      return getFrameWidth(frame) + OBJECT_FRAME_RIGHT_SPACING + maxWidth; 
    }
  }
  
  function getDrawingWidth(levels) { 
    function getTotalWidth(frame){
      // Compare fullwidth + width of children
          
      const children_level = frame.level + 1
      let children = levels[children_level]
      let children_length = 0;
  
      if (children != undefined) {
        children = levels[children_level].frames.filter((f) => f.parent == frame);
        if(children == undefined) {
          return frame.fullwidth;
        }
        for (c in children) {
          children_length += getTotalWidth(children[c]);
        }
  
        children_length += (children.length - 1) * FRAME_SPACING;
      } else {
        return frame.fullwidth;
      }
  
      return Math.max(frame.fullwidth, children_length);
    }  
    return getTotalWidth(levels[1].frames[0])
  }
  
  function getDrawingHeight(levels) {
    let y = 30;
    for (l in levels) {
      y += levels[l].height + LEVEL_SPACING;
    }
    return y;
  }
  
  function getWrapperFromDataObject(dataObject) {
    return dataObjectWrappers[dataObjects.indexOf(dataObject)];
  }

  function initialiseFnObject(fnObject, parent) {
    fnObject.hovered = false;
    fnObject.selected = false;
    fnObject.layer = fnObjectLayer;
    fnObject.color = 'white';
    fnObject.key = fnObjectKey--;
    fnObject.parent = parent;
  }

  function initialiseDataFnObject(fnObject, parent) {
    initialiseFnObject(fnObject, parent)
    fnObject.parenttype = "data"
  }

  function initialiseFrameFnObject(fnObject, parent) {
    initialiseFnObject(fnObject, parent)
    fnObject.parenttype = "frame"
  }
  
  function initialiseDataObjectWrapper(objectName, objectData, parent) {
    const dataObjectWrapper = {
      hovered: false,
      selected: false,
      layer: dataObjectLayer,
      color: 'white',
      key: dataObjectKey--,
      parent: parent,
      data: objectData,
      name: objectName
    };
    return dataObjectWrapper;
  }
  
  // Calculates the unit position of an element (data/primitive/function)
  function findElementPosition(element, frame) {
    let index = 0;
    for(elem in frame.elements){
      if(frame.elements[elem] == element) {
        break;
      }
      if(isFunction(frame.elements[elem])) {
        index += 1;
      } 
      else if(Array.isArray(frame.elements[elem])) {
        const parent = dataObjectWrappers[dataObjects.indexOf(frame.elements[elem])].parent;
        if(parent == frame) {
          index += getUnitHeight(frame.elements[elem]) + 1
        } else {
          index += 1;
        }        
      } else {
        index += 1
      }
    }
    return index;
  }

  // Calculates the unit position of the name of the element (in the frame box)
  function findElementNamePosition(elementName, frame) {
    let lineNo = Object.keys(frame.elements).indexOf(elementName);
    let index = 0;
    for(let i = 0; i < lineNo; i++){
      if(isFunction(Object.values(frame.elements)[i])) {
        index += 1;
      } 
      else if(Array.isArray(Object.values(frame.elements)[i])) {
        const parent = dataObjectWrappers[dataObjects.indexOf(Object.values(frame.elements)[i])].parent;
        if(parent == frame) {
          index += getUnitHeight(Object.values(frame.elements)[i]) + 1;
        } else {
          index += 1;
        }        
      } else {
        index += 1
      }
    }
    return index;
  }
  
  function findFrameIndexInLevel(frame) {
    const level = frame.level;
    return levels[level].frames.indexOf(frame);
  }
  
  function isEmptyFrame(frame) {
    let hasObject = false;
    fnObjects.forEach(function(f) {
      if (f.parent == frame) {
        hasObject = true;
      }
    });
    dataObjectWrappers.forEach(function(d) {
      if (d.parent == frame) {
        hasObject = true;
      }
    });
    return !hasObject 
            && frame.children.length == 0 
            && Object.keys(frame.elements).length == 0;
  }
  
  exports.EnvVisualizer = {
    draw_env: draw_env,
    init: function(parent) {
      container.hidden = false;
      parent.appendChild(container);
    }
  };

  setTimeout(() => {}, 1000);
})(window);