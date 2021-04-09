# gmmkambilightchrome

A WebHID experiment, which streams your desktop to your GMMK keyboard!
![Showcase](https://raw.githubusercontent.com/meinlebenswerk/GMMKAmbilightChrome/master/showcase/streaming.png?raw=true)

## Usage
No more electron, much less hassle, just install `node` and `chrome` and you're good to go!
First clone this repository with

    git clone https://github.com/meinlebenswerk/GMMKAmbilightChrome.git
    cd GMMKAmbilight
   
After that, install all the depencies with:

    npm i
and run the application: 
   

     npm run serve


## Internals
For those who are interested:
The previous version aka [GMMKAmbilight](https://github.com/meinlebenswerk/GMMKAmbilight) relied on electron and the `node-hid` module for communication with the Keyboard.
This experiment uses the new WebHID functionalities, to do all that (but better) directly in chrome.
Chrome's desktopCaputure is used to grab your screen, this is then put into a HTML-Video element - while this could be used directly to read pixels, a further glsl shader is used to gaussian blur ontop of the image.
The blur is currently implemented as a simple, gaussian curve, computed on the JS-Side and then transferred over to the shader.

## Issues

 - ~~the UI get's slowed down by the synchronous USB-Transfers~~
 - currently, only ISO-Keyboard layouts are supported :)
 - Blur filter is not configurable anymore
  
## Big thanks to:
Well the same amazing people, that helped GMMKAmbilight to become a reality!
Most of the control code is ~~stolen~~ inspired by these projects:

 - [dokutan](https://github.com/dokutan)'s [rgb_keyboard](https://github.com/dokutan/rgb_keyboard)
 - [paulguy](https://github.com/paulguy)'s [gmmkctl](https://github.com/paulguy/gmmkctl)
 - [Kolossi](https://github.com/Kolossi)'s [GMMKUtil](https://github.com/Kolossi/GmmkUtil)

Big thanks to paulguy! - Only with the help of gmmkctl and your awesome key-maps, was I able to get the mapping and control to work!
Internally, [Andreas Tare](https://github.com/andresteare)'s keymap for his hand-built `handwired/oem_iso_fullsize` keyboard, is used to map the GMMK's keys to exact pixel positions (This is not entirely necessary, but hey it's kinda cool).

And probably some repos and amazing people I forgot about (sorry, will add you as soon as I remember!).