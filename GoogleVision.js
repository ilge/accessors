// Copyright (c) 2014-2015 The Regents of the University of California.
// All rights reserved.

// Permission is hereby granted, without written agreement and without
// license or royalty fees, to use, copy, modify, and distribute this
// software and its documentation for any purpose, provided that the above
// copyright notice and the following two paragraphs appear in all copies
// of this software.

// IN NO EVENT SHALL THE UNIVERSITY OF CALIFORNIA BE LIABLE TO ANY PARTY
// FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES
// ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF
// THE UNIVERSITY OF CALIFORNIA HAS BEEN ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.

// THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS ANY WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE
// PROVIDED HEREUNDER IS ON AN "AS IS" BASIS, AND THE UNIVERSITY OF
// CALIFORNIA HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES,
// ENHANCEMENTS, OR MODIFICATIONS.

/** Google image processiong API.
 *  @accessor services/GoogleVision
 *  @input {string} address The address, for example "Berkeley, CA".
 *  @output location The location, as an object with a 'latitude' and 'longitude'
 *   property.
 *  @parameter {string} key The key for the Google geocoding API.
 *  @output response An object containing the location information.
 *  @author Ilge Akkaya
 *  @version $$Id$$
 */

// Stop extra messages from jslint and jshint.  Note that there should
// be no space between the / and the * and global. See
// https://chess.eecs.berkeley.edu/ptexternal/wiki/Main/JSHint */
/*globals addInputHandler, get, getParameter, error, exports, extend, get, input, output, parameter, require, send */
/*jshint globalstrict: true*/
'use strict';

/** Set up the accessor by defining the inputs and outputs.
 */
exports.setup = function() {
    this.extend('net/REST');
    this.input('image');
    this.output('annotation');
    this.output('emotion');
    this.output('hueCmd',{'type':'JSON'});
    this.parameter('key', {'type':'string', 'value':'Enter Key Here'}); // FIXME: key is now hard coded
    
    // Change default values of the base class inputs.
    // Also, hide base class inputs, except trigger.
    // Note the need for quotation marks on the options parameter.
    this.input('options', {'visibility':'expert', 'value':{"headers":{"Content-Type":"application/json"}, "method":"POST", "url":"https://vision.googleapis.com"}});
    this.input('command', {'visibility':'expert', 'value':'/v1/images:annotate/'});
    // NOTE: The value can be given as a JSON string or a JavaScript object.
    this.input('arguments', {'visibility':'expert', 'value':{"alt" : "json", "key":""}});
    this.input('body', {'visibility':'expert'});
    this.input('trigger', {'visibility':'expert'});
    this.output('headers', {'visibility':'expert'});
    this.output('status', {'visibility':'expert'});
    this.parameter('outputCompleteResponsesOnly', {'visibility':'expert'});
};

exports.initialize = function() {
    // Be sure to call the superclass so that the trigger input handler gets registered.
    exports.ssuper.initialize.call(this);
     
    var self = this;
    
    // Handle location information.
    this.addInputHandler('image', function() {
        var image = this.get('image');
        if (image) {
            var body = {
                'requests' : [  { "image" : {"content" : ""}, 
                                  "features" : [  { "type" : "FACE_DETECTION", 
                                                    "maxResults" : 1
                                                  }
                                               ]
                                }
                             ]
            };
            body.requests[0].image.content = image;
            //console.log(JSON.stringify(body));
            self.send('body', JSON.stringify(body));
            self.send('trigger', true);
        } else {
            throw 'GoogleVision: No image.';
        }
    });
};

/** Filter the response, extracting the latitude and longitude and
 *  formatting.
 */
exports.filterResponse = function(response) {
    if (response) {
        // Note that for some hosts, the response is a string, needing to parsed,
        // and for some, its already been parsed.
        var parsed = response;
        
        if (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(response);
            } catch (err) {
                error('GeoCoder: Unable to parse response: ' + err.message +
                        '\nResponse was: ' + response);
                // So that downstream actors don't just a previous location, send null.
                //this.send('location', null);
            }
        }
        
        if (parsed && parsed.responses) { 
           
           //console.log(parsed.responses[0]);
           
            if (parsed.responses[0].faceAnnotations) {
                
                
                var result = parsed.responses[0].faceAnnotations[0];
                 
                //console.log(result);
                var emotionNames = ['joy','sorrow','anger','surprise','unknown'];
                var emotions = [result.joyLikelihood, result.sorrowLikelihood,
                result.angerLikelihood, result.surpriseLikelihood];
                
                var emotionLikelihood = [0,0,0,0];
                var emotionColorMap = [25500, 46920, 65280, 12750, 0];
                var maxSoFar = -2;
                var currentEmotion = 'neutral';
                var currentEmotionIndex = 4;
                for (var i=0; i < emotions.length; i++) {
                    switch(emotions[i]) {
                        case 'UNKNOWN': emotionLikelihood[i]= -10; break;
                        case 'VERY_UNLIKELY': emotionLikelihood[i] = -2; break;
                        case 'UNLIKELY': emotionLikelihood[i] = -1; break;
                        case 'POSSIBLE': emotionLikelihood[i] = 1; break;
                        case 'LIKELY': emotionLikelihood[i] = 2; break;
                        case 'VERY_LIKELY': emotionLikelihood[i] = 3; break;
                        default: emotionLikelihood[i] = -10; break;
                    }
                    
                    if (emotionLikelihood[i] > maxSoFar) {
                        currentEmotion = emotionNames[i];
                        currentEmotionIndex = i;
                    }
                }
                console.log(emotionLikelihood);
                this.send('emotion', currentEmotion);
                var hueCommand =[{'id':7,'on':false},{'id':8,'on':false},{'id':9,'on':false}]; 
                var hue = 0;
                if ( !currentEmotion.equals('neutral')) { 
                    hue = emotionColorMap[currentEmotionIndex];
                    hueCommand = [{'id':7,'on':true,'hue':hue, 'sat':255},
                    {'id':8,'on':true,'hue':hue,'sat':255},
                    {'id':9,'on':true,'hue':hue,'sat':255}];
                }
               
                 
                
                this.send('hueCmd', hueCommand);
            }
            
        }
    }
    return response;
};
