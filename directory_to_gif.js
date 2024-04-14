
(function() {
    
    var button;

    async function dataURLtoFile(dataurl, filename) {
        var arr = dataurl.split(","),
          mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[arr.length - 1]),
          n = bstr.length,
          u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }

        const blob = new Blob([u8arr], { type: mime });
        const buffer = Buffer.from( await blob.arrayBuffer() );
        fs.writeFile(filename, buffer, () => {} );
      }

    async function recordModel(options, out_path) {
        Modes.options.animate.select();
        await new Promise((resolve) => setTimeout(resolve, 1000));

        let gifDataPromise = new Promise((resolve, reject) => {
            Screencam.createGif(options , resolve)
        });

        const rec_btn = document.querySelector("#gif_recording_controls > div.tool.gif_record_button");
        rec_btn.click();

        let dataURL = await gifDataPromise;
        await dataURLtoFile(dataURL, out_path);
    }

    let dia = new Dialog({
            id: 'create_gif_batch',
            title: 'Directory to GIF',
            draggable: true,
            form: {
                // format: {label: 'dialog.create_gif.format', type: 'select', options: {
                //     gif: 'dialog.create_gif.format.gif',
                //     apng: 'APNG',
                //     png_sequence: 'dialog.create_gif.format.png_sequence',
                // }},
                input_dir:   {label: 'Input Directory', type: 'folder'},
                input_rec: 	 {label: 'Scan subdirectories', type: 'checkbox', value: true},
                '_0': '_',
                output_dir:  {label: 'Output Directory', type: 'folder'},
                output_struct: 	{label: 'Reconstruct input folder structure', type: 'checkbox'},
                '_1': '_',
                length_mode: {label: 'dialog.create_gif.length_mode', type: 'select', default: 'seconds', options: {
                    seconds: 'dialog.create_gif.length_mode.seconds',
                    frames: 'dialog.create_gif.length_mode.frames',
                    animation: 'dialog.create_gif.length_mode.animation',
                    turntable: 'dialog.create_gif.length_mode.turntable',
                }},
                length: 	{label: 'dialog.create_gif.length', type: 'number', value: 5, min: 0.1, step: 0.25, condition: (form) => ['seconds', 'frames'].includes(form.length_mode)},
                fps: 		{label: 'dialog.create_gif.fps', type: 'number', value: 20, min: 0.5, max: 120},
                resolution: {type: 'vector', label: 'dialog.advanced_screenshot.resolution', dimensions: 2, value: [500, 500], toggle_enabled: true, toggle_default: false},
                zoom: 		{type: 'number', label: 'dialog.advanced_screenshot.zoom', value: 42, toggle_enabled: true, toggle_default: false},
                '_2': '_',
                pixelate:	{label: 'dialog.create_gif.pixelate', type: 'range', value: 1, min: 1, max: 8, step: 1},
                color:  	{label: 'dialog.create_gif.color', type: 'color', value: '#00000000'},
                bg_image:  	{label: 'dialog.create_gif.bg_image', type: 'file', extensions: ['png'], readtype: 'image', filetype: 'PNG'},
                turn:		{label: 'dialog.create_gif.turn', type: 'number', value: 0, min: -90, max: 90, description: 'dialog.create_gif.turn.desc'},
                play: 		{label: 'dialog.create_gif.play', type: 'checkbox', condition: () => Animator.open},
            },
            onConfirm(formData) {
                let background = formData.color.toHex8String() != '#00000000' ? formData.color.toHexString() : undefined;
                this.hide();
                if (document.getElementById('gif_recording_frame')) {
                    document.getElementById('gif_recording_frame').remove();
                }
                button.beginRecord({
                    input_dir: formData.input_dir,
                    input_rec: formData.input_rec,
                    output_dir: formData.output_dir,
                    output_struct: formData.output_struct,
                    format: 'gif',//formData.format,
                    length_mode: formData.length_mode,
                    length: formData.length,
                    fps: formData.fps,
                    resolution: formData.resolution,
                    zoom: formData.zoom,
                    quality: formData.quality,
                    pixelate: formData.pixelate,
                    background,
                    background_image: formData.bg_image,
                    play: formData.play,
                    turnspeed: formData.turn,
                })
            }
        })

    BBPlugin.register('directory_to_gif', {
        title: 'Directory to GIF',
        author: 'Onusai',
        icon: 'icon-saved',
        description: 'Create GIFs for all models in a directory',
        version: '1.0.0',
        variant: 'desktop',
        
        onload() {
            button = new Action('directory_to_gif', {
                name: 'Directory to GIF',
                description: 'Create GIFs for all models in a directory',
                icon: 'icon-saved',
                click: async function() {
                    dia.show();
                }
            });

            button.beginRecord = async function(options) {
                let inputDir = options.input_dir.replaceAll('\\', '/');
                let outputDir = options.output_dir.replaceAll('\\', '/');
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

                let files = [];
                const getFilesRecursively = (directory) => {
                    const filesInDirectory = fs.readdirSync(directory);
                    for (const file of filesInDirectory) {
                        const absolute = `${directory}/${file}`;
                        if (fs.statSync(absolute).isDirectory()) {
                            if (options.input_rec) getFilesRecursively(absolute);
                        } else {
                            if (absolute.endsWith(".bbmodel")) files.push(absolute);
                        }
                    }
                };

                getFilesRecursively(inputDir);
                for (const path of files) {
                    shell.openPath(path)
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    let out_dir = outputDir;
                    if (options.output_struct) {
                        out_dir += path.slice(inputDir.length, path.length-1-`${Project.name}.bbmodel`.length)
                        if (!fs.existsSync(out_dir)) fs.mkdirSync(out_dir, { recursive: true });
                    }
                    let out_path = `${out_dir}/${Project.name}.gif`
                    console.log(out_path);
                    await recordModel(options, `${out_dir}/${Project.name}.gif`)
                    Project.close();
                }
            },
            MenuBar.addAction(button, 'filter');
            
        },
        onunload() {
            button.delete();
        }
    });

})();